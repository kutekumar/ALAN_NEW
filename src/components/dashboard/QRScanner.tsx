import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const QRScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<any | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [verifying, setVerifying] = useState(false);

  const startScanning = () => {
    setScanning(true);
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      async (decodedText) => {
        setVerifying(true);
        try {
          // Parse the QR code to get order ID
          let orderId = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            orderId = parsed.orderId || parsed.id || decodedText;
          } catch {
            // Use as is if not JSON
          }

          // Fetch the actual order from database
          const { data, error } = await supabase
            .from('orders')
            .select(`
              *,
              profiles (full_name),
              restaurants (name)
            `)
            .eq('qr_code', decodedText)
            .single();

          if (error) throw error;

          if (!data) {
            toast.error('Order not found');
            return;
          }

          setScannedOrder(data);
          toast.success('Order verified successfully!');
          stopScanning();
        } catch (error) {
          console.error('Error verifying order:', error);
          toast.error('Failed to verify order');
        } finally {
          setVerifying(false);
        }
      },
      (error) => {
        console.log(error);
      }
    );

    scannerRef.current = scanner;
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const markAsServed = async () => {
    if (!scannedOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', scannedOrder.id);

      if (error) throw error;

      toast.success('Order marked as served!');
      setScannedOrder(null);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">QR Scanner</h2>
        <p className="text-muted-foreground">Scan customer booking QR codes</p>
      </div>

      {!scanning && !scannedOrder && (
        <Card className="border-border/50 luxury-shadow">
          <CardContent className="py-12 text-center space-y-4">
            <Camera className="h-16 w-16 mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Ready to Scan</h3>
              <p className="text-muted-foreground mb-4">
                Click the button below to activate your camera and scan customer QR codes
              </p>
              <Button onClick={startScanning} className="luxury-gradient" size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Start Scanner
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card className="border-border/50 luxury-shadow">
          <CardHeader>
            <CardTitle>Scanning...</CardTitle>
            <CardDescription>Position the QR code within the frame</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="qr-reader" className="w-full"></div>
            <Button onClick={stopScanning} variant="outline" className="w-full">
              <XCircle className="w-4 h-4 mr-2" />
              Stop Scanning
            </Button>
          </CardContent>
        </Card>
      )}

      {scannedOrder && (
        <Card className="border-border/50 luxury-shadow">
          <CardHeader>
            <CardTitle className="text-xl">Order Details</CardTitle>
            <CardDescription>
              Order ID: {scannedOrder.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{scannedOrder.profiles?.full_name || 'Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Restaurant:</span>
                <span className="font-medium">{scannedOrder.restaurants?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Type:</span>
                <span className="font-medium capitalize">{scannedOrder.order_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{scannedOrder.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Items:</h4>
              <ul className="space-y-1">
                {scannedOrder.order_items.map((item: any, idx: number) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{(item.price * item.quantity).toLocaleString()} MMK</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-lg">{scannedOrder.total_amount.toLocaleString()} MMK</span>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={markAsServed} className="flex-1 luxury-gradient" size="lg">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Mark as Served
              </Button>
              <Button onClick={() => setScannedOrder(null)} variant="outline" className="flex-1" size="lg">
                Scan Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QRScanner;
