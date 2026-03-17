import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from 'sonner';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Create the scanner instance
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Stop scanning after a success to avoid multiple rapid scans
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        }
        onScanSuccess(decodedText);
      },
      (error) => {
        if (onScanError) onScanError(error);
      }
    );

    // Cleanup function to stop the scanner when the component unmounts
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          // This can fail if already cleared or never started, just log it
          console.debug("Scanner cleanup notice:", err);
        });
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-primary/20 glass-card">
      <div id="qr-reader" className="w-full"></div>
      <div className="p-4 text-center bg-secondary/30">
        <p className="text-xs text-muted-foreground">Align the QR code within the frame to scan</p>
      </div>
    </div>
  );
};

export default QrScanner;
