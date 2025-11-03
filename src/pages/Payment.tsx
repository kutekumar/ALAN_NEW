import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CreditCard, Smartphone, Wallet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const paymentMethods = [
  { id: 'mpu', name: 'MPU Card', icon: CreditCard },
  { id: 'kbzpay', name: 'KBZPay', icon: Smartphone },
  { id: 'wavepay', name: 'WavePay', icon: Wallet },
];

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, restaurant, orderType, totalAmount } = location.state || {};
  
  const [selectedPayment, setSelectedPayment] = useState<'mpu' | 'kbzpay' | 'wavepay'>('kbzpay');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!cart || !restaurant) {
    navigate('/home');
    return null;
  }

  const handlePayment = async () => {
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please sign in to complete your order');
        navigate('/auth');
        return;
      }

      // Generate QR code data
      const qrData = `ALAN-${Date.now()}-${restaurant.id}`;

      // Helper to build a local mock order when backend insert isn't possible
      const buildLocalOrder = () => ({
        id: `local-${Date.now()}`,
        customer_id: user.id,
        restaurant_id: restaurant.id,
        order_type: orderType,
        payment_method: selectedPayment,
        total_amount: totalAmount,
        status: 'paid' as const,
        qr_code: qrData,
        order_items: cart as any,
      });

      // If the restaurant.id isn't a UUID (mock data uses '1','2',...), skip DB and proceed with mock confirmation
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          restaurant.id
        );

      if (!isUuid) {
        const order = buildLocalOrder();
        // Store mock order in localStorage
        const existingOrders = JSON.parse(localStorage.getItem('mockOrders') || '[]');
        localStorage.setItem('mockOrders', JSON.stringify([...existingOrders, { ...order, restaurant, created_at: new Date().toISOString() }]));
        toast.success('Payment successful! (mock)');
        navigate('/confirmation', { state: { order, restaurant, orderType } });
        return;
      }

      // Create order in database
      const { data: order, error } = await supabase
        .from('orders')
        .insert([
          {
            customer_id: user.id,
            restaurant_id: restaurant.id,
            order_type: orderType,
            payment_method: selectedPayment,
            total_amount: totalAmount,
            status: 'paid' as const,
            qr_code: qrData,
            order_items: cart as any,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('Payment successful!');
      navigate('/confirmation', { state: { order, restaurant, orderType } });
    } catch (error: any) {
      console.error('Payment error:', error);
      // Fallback to mock confirmation so the user can proceed in the MVP
      const qrData = `ALAN-${Date.now()}-${restaurant.id}`;
      const order: any = {
        id: `local-${Date.now()}`,
        customer_id: 'guest',
        restaurant_id: restaurant.id,
        order_type: orderType,
        payment_method: selectedPayment,
        total_amount: totalAmount,
        status: 'paid',
        qr_code: qrData,
        order_items: cart,
      };
      // Store mock order in localStorage
      const existingOrders = JSON.parse(localStorage.getItem('mockOrders') || '[]');
      localStorage.setItem('mockOrders', JSON.stringify([...existingOrders, { ...order, restaurant, created_at: new Date().toISOString() }]));
      toast.success('Payment successful! (mock)');
      navigate('/confirmation', { state: { order, restaurant, orderType } });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Payment</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-6 space-y-6">
        {/* Order Summary */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">Order Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Restaurant</span>
              <span className="font-medium">{restaurant.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Type</span>
              <span className="font-medium capitalize">{orderType.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{cart.length} item(s)</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Total Amount</span>
              <span className="font-bold text-primary text-lg">
                {totalAmount.toLocaleString()} MMK
              </span>
            </div>
          </div>
        </Card>

        {/* Payment Method */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold text-lg">Payment Method</h2>
          <RadioGroup value={selectedPayment} onValueChange={(value) => setSelectedPayment(value as 'mpu' | 'kbzpay' | 'wavepay')}>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <div
                  key={method.id}
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedPayment(method.id as 'mpu' | 'kbzpay' | 'wavepay')}
                >
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Label htmlFor={method.id} className="flex items-center gap-3 cursor-pointer flex-1">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{method.name}</span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </Card>

        {/* Cart Items */}
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">Items</h2>
          {cart.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.name} x {item.quantity}
              </span>
              <span className="font-medium">
                {(item.price * item.quantity).toLocaleString()} MMK
              </span>
            </div>
          ))}
        </Card>

        {/* Confirm Button */}
        <Button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full luxury-gradient h-12 text-base"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing Payment...
            </>
          ) : (
            `Pay ${totalAmount.toLocaleString()} MMK`
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          This is a mock payment. No actual transaction will occur.
        </p>
      </div>
    </div>
  );
};

export default Payment;
