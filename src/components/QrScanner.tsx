import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-target";

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(containerId);
    scannerRef.current = html5QrCode;

    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    // Start scanning using the back camera (environment)
    html5QrCode.start(
      { facingMode: "environment" }, 
      config,
      (decodedText) => {
        // Success! Stop scanning and report back
        html5QrCode.stop().then(() => {
          onScanSuccess(decodedText);
        }).catch(err => {
          console.error("Error stopping scanner after success", err);
          onScanSuccess(decodedText); // Still call success even if stop fails
        });
      },
      (errorMessage) => {
        // Suppress noisy frame-by-frame errors unless requested
        if (onScanError) onScanError(errorMessage);
      }
    ).catch(err => {
      console.error("Unable to start scanning", err);
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.debug("Scanner cleanup notice:", err));
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-primary/20 bg-black relative aspect-square group">
      <div id={containerId} className="w-full h-full"></div>
      
      {/* Visual Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="w-[250px] h-[250px] border-2 border-primary rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.5)] animate-pulse mb-4"></div>
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <Camera className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Scanning...</span>
        </div>
      </div>

      <div className="absolute bottom-4 inset-x-4 text-center">
        <p className="text-[10px] text-white/60 bg-black/40 py-2 rounded-lg backdrop-blur-sm">
          Point your camera at a participant's QR code
        </p>
      </div>
    </div>
  );
};

export default QrScanner;
