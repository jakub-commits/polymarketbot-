'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTraders } from '@/hooks/useTraders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function AddTraderPage() {
  const router = useRouter();
  const { addTrader } = useTraders();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    walletAddress: '',
    name: '',
    description: '',
    allocationPercent: 10,
    maxPositionSize: '',
    minTradeAmount: 1,
    slippageTolerance: 2,
    maxDrawdownPercent: 20,
    stopLossPercent: '',
    takeProfitPercent: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await addTrader({
        walletAddress: formData.walletAddress,
        name: formData.name || undefined,
        description: formData.description || undefined,
        allocationPercent: Number(formData.allocationPercent),
        maxPositionSize: formData.maxPositionSize
          ? Number(formData.maxPositionSize)
          : undefined,
        minTradeAmount: Number(formData.minTradeAmount),
        slippageTolerance: Number(formData.slippageTolerance),
        maxDrawdownPercent: Number(formData.maxDrawdownPercent),
        stopLossPercent: formData.stopLossPercent
          ? Number(formData.stopLossPercent)
          : undefined,
        takeProfitPercent: formData.takeProfitPercent
          ? Number(formData.takeProfitPercent)
          : undefined,
      });

      router.push('/traders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add trader');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/traders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add Trader</h1>
          <p className="text-muted-foreground">
            Add a new trader to copy their trades
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Trader Information</CardTitle>
            <CardDescription>
              Enter the wallet address of the trader you want to copy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Wallet Address <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleChange}
                placeholder="0x..."
                required
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Name (optional)</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Whale Trader"
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Notes about this trader..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Copy Settings</CardTitle>
            <CardDescription>
              Configure how trades should be copied
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Allocation (% of capital)
                </label>
                <input
                  type="number"
                  name="allocationPercent"
                  value={formData.allocationPercent}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Max Position Size (USDC)
                </label>
                <input
                  type="number"
                  name="maxPositionSize"
                  value={formData.maxPositionSize}
                  onChange={handleChange}
                  placeholder="No limit"
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Min Trade Amount (USDC)
                </label>
                <input
                  type="number"
                  name="minTradeAmount"
                  value={formData.minTradeAmount}
                  onChange={handleChange}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Slippage Tolerance (%)
                </label>
                <input
                  type="number"
                  name="slippageTolerance"
                  value={formData.slippageTolerance}
                  onChange={handleChange}
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Risk Management</CardTitle>
            <CardDescription>
              Set limits to protect your capital
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Max Drawdown (%)
                </label>
                <input
                  type="number"
                  name="maxDrawdownPercent"
                  value={formData.maxDrawdownPercent}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stop Loss (%)</label>
                <input
                  type="number"
                  name="stopLossPercent"
                  value={formData.stopLossPercent}
                  onChange={handleChange}
                  placeholder="Optional"
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Take Profit (%)</label>
                <input
                  type="number"
                  name="takeProfitPercent"
                  value={formData.takeProfitPercent}
                  onChange={handleChange}
                  placeholder="Optional"
                  min="1"
                  max="1000"
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/traders">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Trader'}
          </Button>
        </div>
      </form>
    </div>
  );
}
