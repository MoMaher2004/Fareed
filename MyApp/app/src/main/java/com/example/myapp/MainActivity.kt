package com.example.myapp

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import java.io.OutputStream
import java.util.*

class MainActivity : AppCompatActivity() {

    private val HC05_UUID: UUID =
        UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    private var bluetoothSocket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val inputField = findViewById<EditText>(R.id.inputField)
        val sendButton = findViewById<Button>(R.id.sendButton)

        requestPermissions()

        sendButton.setOnClickListener {
            val text = inputField.text.toString()
            sendData(text)
        }
    }

    private fun requestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        val notGranted = permissions.filter {
            ActivityCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (notGranted.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, notGranted.toTypedArray(), 1)
        } else {
            connectToHC05()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1 && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            connectToHC05()
        }
    }

    private fun connectToHC05() {
        try {
            val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()

            // Replace with your HC-05 MAC address
            val device: BluetoothDevice =
                bluetoothAdapter.getRemoteDevice("98:D3:41:F6:C8:41")

            bluetoothSocket =
                device.createRfcommSocketToServiceRecord(HC05_UUID)

            bluetoothSocket?.connect()
            outputStream = bluetoothSocket?.outputStream
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun sendData(data: String) {
        outputStream?.write(data.toByteArray())
    }
}