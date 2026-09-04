package com.kissultra.gui;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KissSerialPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
