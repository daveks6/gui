package com.kissultra.gui;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver;
import com.hoho.android.usbserial.driver.ProbeTable;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.util.List;

/**
 * Native USB CDC-ACM serial bridge for the KISS ULTRA FC, following the same
 * approach Betaflight Configurator uses on Android: talk to Android's
 * UsbManager directly via usb-serial-for-android instead of relying on
 * WebUSB/Web Serial in the WebView, since neither is reliably functional
 * there (confirmed against real hardware -- see connection_handler.js).
 */
@CapacitorPlugin(name = "KissSerial")
public class KissSerialPlugin extends Plugin implements SerialInputOutputManager.Listener {

    // The KISS ULTRA's STM32 Virtual COM Port ID. Not in the library's small
    // built-in default table, so it's added explicitly below.
    private static final int VENDOR_ID = 0x0483;
    private static final int PRODUCT_ID = 0x5740;

    private final String actionUsbPermission = "com.kissultra.gui.USB_PERMISSION";

    private UsbSerialPort port;
    private SerialInputOutputManager ioManager;
    private PluginCall pendingConnectCall;
    private UsbSerialDriver pendingDriver;

    private final BroadcastReceiver usbPermissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!actionUsbPermission.equals(intent.getAction())) {
                return;
            }
            PluginCall call = pendingConnectCall;
            UsbSerialDriver driver = pendingDriver;
            pendingConnectCall = null;
            pendingDriver = null;
            if (call == null || driver == null) {
                return;
            }
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted) {
                openPort(driver, call);
            } else {
                call.reject("USB permission denied by user");
            }
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(actionUsbPermission);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(usbPermissionReceiver, filter);
        }
    }

    private UsbSerialDriver findDriver(UsbManager usbManager) {
        ProbeTable table = UsbSerialProber.getDefaultProbeTable();
        table.addProduct(VENDOR_ID, PRODUCT_ID, CdcAcmSerialDriver.class);
        UsbSerialProber prober = new UsbSerialProber(table);
        List<UsbSerialDriver> drivers = prober.findAllDrivers(usbManager);
        return drivers.isEmpty() ? null : drivers.get(0);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        UsbSerialDriver driver = findDriver(usbManager);

        if (driver == null) {
            call.reject("No USB serial device found");
            return;
        }

        UsbDevice device = driver.getDevice();

        if (usbManager.hasPermission(device)) {
            openPort(driver, call);
            return;
        }

        pendingConnectCall = call;
        pendingDriver = driver;

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(
                getContext(), 0, new Intent(actionUsbPermission), flags);
        usbManager.requestPermission(device, permissionIntent);
    }

    private void openPort(UsbSerialDriver driver, PluginCall call) {
        UsbManager usbManager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        UsbDeviceConnection connection = usbManager.openDevice(driver.getDevice());
        if (connection == null) {
            call.reject("Failed to open USB device (no permission or device busy)");
            return;
        }
        if (driver.getPorts().isEmpty()) {
            call.reject("USB serial driver exposes no ports");
            return;
        }

        port = driver.getPorts().get(0);
        try {
            port.open(connection);
            int baudRate = call.getInt("baudRate", 115200);
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
        } catch (Exception e) {
            call.reject("Failed to open port: " + e.getMessage(), e);
            return;
        }

        ioManager = new SerialInputOutputManager(port, this);
        ioManager.start();

        JSObject result = new JSObject();
        result.put("vendorId", driver.getDevice().getVendorId());
        result.put("productId", driver.getDevice().getProductId());
        call.resolve(result);
    }

    @PluginMethod
    public void write(PluginCall call) {
        String base64Data = call.getString("data");
        if (port == null) {
            call.reject("Not connected");
            return;
        }
        if (base64Data == null) {
            call.reject("No data provided");
            return;
        }
        try {
            byte[] data = Base64.decode(base64Data, Base64.NO_WRAP);
            port.write(data, 2000);
            call.resolve();
        } catch (Exception e) {
            call.reject("Write failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (ioManager != null) {
                ioManager.setListener(null);
                ioManager.stop();
                ioManager = null;
            }
            if (port != null) {
                port.close();
                port = null;
            }
            call.resolve();
        } catch (Exception e) {
            // Already gone is fine -- disconnect should never fail the caller.
            port = null;
            ioManager = null;
            call.resolve();
        }
    }

    @Override
    public void onNewData(byte[] data) {
        JSObject event = new JSObject();
        event.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        notifyListeners("dataReceived", event);
    }

    @Override
    public void onRunError(Exception e) {
        JSObject event = new JSObject();
        event.put("message", e.getMessage() == null ? e.toString() : e.getMessage());
        notifyListeners("serialError", event);
    }
}
