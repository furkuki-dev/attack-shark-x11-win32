import * as usbPackage from 'usb';
import * as HID from 'node-hid';

interface UsbDevice {
	vendorId: number;
	productId: number;
	serialNumber?: string | undefined;
	deviceVersionMajor: number;
	deviceVersionMinor: number;
	deviceVersionSubminor: number;
	configurations: Array<{ configurationValue: number }>;
	opened: boolean;
	open(): Promise<void>;
	close(): Promise<void>;
	claimInterface(interfaceNumber: number): Promise<void>;
	releaseInterface(interfaceNumber: number): Promise<void>;
	selectConfiguration(configurationValue: number): Promise<void>;
	detachKernelDriver(interfaceNumber: number): Promise<void>;
	attachKernelDriver(interfaceNumber: number): Promise<void>;
	nativeControlTransferIn(setup: unknown, timeout: number, length: number): Promise<Uint8Array | null>;
	nativeControlTransferOut(setup: unknown, timeout: number, data?: Uint8Array | null): Promise<number>;
	nativeTransferIn(endpointNumber: number, timeout: number, length: number): Promise<Uint8Array | null>;
	nativeTransferOut(endpointNumber: number, timeout: number, data: Uint8Array): Promise<number>;
}

interface UsbBinding {
	findDeviceByIds?: (vendorId: number, productId: number) => Promise<UsbDevice | null>;
	nativeFindDeviceByIds?: (vendorId: number, productId: number) => Promise<UsbDevice | null>;
	usb?: UsbBinding;
	default?: UsbBinding;
}

interface HidDeviceInfo {
	path?: string;
	vendorId?: number;
	productId?: number;
	interface?: number;
	usagePage?: number;
	usage?: number;
	manufacturer?: string;
	product?: string;
	serialNumber?: string | undefined;
}

interface HidDeviceHandle {
	close(): void;
	sendFeatureReport(data: number[]): number;
	readTimeout(timeout: number): number[];
	on(event: 'data', listener: (data: Buffer) => void): unknown;
	on(event: 'error', listener: (error: Error) => void): unknown;
	removeAllListeners(event: 'data' | 'error'): unknown;
}

const MAX_QUEUED_REPORTS = 32;

/**
 * Turns node-hid's event stream into "give me the next report, or nothing after N ms".
 * readTimeout() blocks the Electron main thread for the whole timeout, which freezes the UI.
 * Events never block: reports are queued here and handed to whoever asks for them.
 */
class HidInputPump {
	private readonly reports: number[][] = [];
	private readonly waiters: Array<(report: number[] | null) => void> = [];

	private readonly onData = (data: Buffer): void => {
		const waiter = this.waiters.shift();
		if (waiter) {
			waiter(Array.from(data));
			return;
		}
		this.reports.push(Array.from(data));
		if (this.reports.length > MAX_QUEUED_REPORTS) this.reports.shift();
	};

	private readonly onError = (): void => {
		// Device unplugged or read failed: wake every waiter so the caller can decide what to do.
		while (this.waiters.length > 0) this.waiters.shift()?.(null);
	};

	constructor(private readonly handle: HidDeviceHandle) {
		handle.on('data', this.onData);
		handle.on('error', this.onError);
	}

	next(timeoutMs: number): Promise<number[] | null> {
		const queued = this.reports.shift();
		if (queued) return Promise.resolve(queued);
		return new Promise((resolve) => {
			const waiter = (report: number[] | null): void => {
				clearTimeout(timer);
				resolve(report);
			};
			const timer = setTimeout(() => {
				const index = this.waiters.indexOf(waiter);
				if (index >= 0) this.waiters.splice(index, 1);
				resolve(null);
			}, timeoutMs);
			this.waiters.push(waiter);
		});
	}

	dispose(): void {
		this.handle.removeAllListeners('data');
		this.handle.removeAllListeners('error');
		this.reports.length = 0;
		while (this.waiters.length > 0) this.waiters.shift()?.(null);
	}
}

const WINDOWS_HID_VENDOR_ID = 0x1d57;
const WINDOWS_HID_PRODUCT_IDS = new Set([0xfa55, 0xfa60, 0xfa61]);
const WINDOWS_HID_INTERFACE = 2;

const loadedUsb = usbPackage as UsbBinding;
const usbBinding = loadedUsb.usb ?? loadedUsb.default ?? loadedUsb;

class WindowsHidUsbDevice implements UsbDevice {
	vendorId: number;
	productId: number;
	serialNumber?: string | undefined;
	deviceVersionMajor = 1;
	deviceVersionMinor = 0;
	deviceVersionSubminor = 0;
	configurations = [{ configurationValue: 1 }];
	opened = false;
	private featureHandle: HidDeviceHandle | null = null;
	private inputHandle: HidDeviceHandle | null = null;
	private inputPump: HidInputPump | null = null;

	constructor(
		private readonly featureInfo: HidDeviceInfo,
		private readonly inputInfo: HidDeviceInfo | null,
	) {
		this.vendorId = featureInfo.vendorId ?? WINDOWS_HID_VENDOR_ID;
		this.productId = featureInfo.productId ?? 0;
		this.serialNumber = featureInfo.serialNumber?.trim() || undefined;
	}

	async open(): Promise<void> {
		if (this.opened) return;
		if (!this.featureInfo.path) throw new Error('Windows HID device has no path');
		this.featureHandle = new HID.HID(this.featureInfo.path) as HidDeviceHandle;
		if (this.inputInfo?.path && this.inputInfo.path !== this.featureInfo.path) {
			try {
				this.inputHandle = new HID.HID(this.inputInfo.path) as HidDeviceHandle;
			} catch {
				this.inputHandle = null;
			}
		}
		this.inputPump = this.inputHandle ? new HidInputPump(this.inputHandle) : null;
		this.opened = true;
	}

	async close(): Promise<void> {
		if (!this.opened) return;
		this.inputPump?.dispose();
		this.inputPump = null;
		this.inputHandle?.close();
		this.featureHandle?.close();
		this.inputHandle = null;
		this.featureHandle = null;
		this.opened = false;
	}

	async claimInterface(_interfaceNumber: number): Promise<void> {
		this.ensureOpen();
	}

	async releaseInterface(_interfaceNumber: number): Promise<void> {
		this.ensureOpen();
	}

	async selectConfiguration(_configurationValue: number): Promise<void> {
		this.ensureOpen();
	}

	async detachKernelDriver(_interfaceNumber: number): Promise<void> {
		// node-hid does not expose kernel-driver lifecycle operations.
	}

	async attachKernelDriver(_interfaceNumber: number): Promise<void> {
		// node-hid does not expose kernel-driver lifecycle operations.
	}

	async nativeControlTransferIn(_setup: unknown, _timeout: number, _length: number): Promise<Uint8Array | null> {
		this.ensureOpen();
		return null;
	}

	async nativeControlTransferOut(_setup: unknown, _timeout: number, data?: Uint8Array | null): Promise<number> {
		const featureHandle = this.ensureOpen();
		if (!data || data.length === 0) return 0;
		return featureHandle.sendFeatureReport(Array.from(data));
	}

	async nativeTransferIn(_endpointNumber: number, timeout: number, _length: number): Promise<Uint8Array | null> {
		this.ensureOpen();
		if (!this.inputPump) return null;
		const report = await this.inputPump.next(timeout);
		return report && report.length > 0 ? Uint8Array.from(report) : null;
	}

	async nativeTransferOut(_endpointNumber: number, _timeout: number, _data: Uint8Array): Promise<number> {
		this.ensureOpen();
		throw new Error('HID interrupt writes are not supported by the Windows HID transport');
	}

	private ensureOpen(): HidDeviceHandle {
		if (!this.opened || !this.featureHandle) throw new Error('Windows HID device is not open');
		return this.featureHandle;
	}
}

function findWindowsHidDevice(vendorId: number, productId: number): UsbDevice | null {
	if (process.platform !== 'win32') return null;
	if (vendorId !== WINDOWS_HID_VENDOR_ID || !WINDOWS_HID_PRODUCT_IDS.has(productId)) return null;

	const devices = HID.devices() as HidDeviceInfo[];
	const matches = devices.filter((device) => device.vendorId === vendorId && device.productId === productId);
	const featureDevice =
		matches.find(
			(device) =>
				device.interface === WINDOWS_HID_INTERFACE &&
				typeof device.path === 'string' &&
				device.path.toLowerCase().includes('col04'),
		) ??
		matches.find((device) => device.interface === WINDOWS_HID_INTERFACE && typeof device.path === 'string') ??
		matches.find((device) => typeof device.path === 'string');
	const inputDevice =
		matches.find(
			(device) =>
				device.interface === WINDOWS_HID_INTERFACE &&
				device.usagePage === 0x0a &&
				typeof device.path === 'string',
		) ?? null;

	return featureDevice ? new WindowsHidUsbDevice(featureDevice, inputDevice) : null;
}

export const usb = {
	async findDeviceByIds(vendorId: number, productId: number): Promise<UsbDevice | null> {
		const hidDevice = findWindowsHidDevice(vendorId, productId);
		if (hidDevice) return hidDevice;

		const finder = usbBinding.findDeviceByIds ?? usbBinding.nativeFindDeviceByIds;
		if (!finder) {
			throw new Error('Installed usb module does not expose findDeviceByIds/nativeFindDeviceByIds');
		}
		return finder(vendorId, productId);
	},
};
