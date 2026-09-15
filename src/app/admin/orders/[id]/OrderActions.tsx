'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { fulfillOrder, initiateRefundAction } from '@/app/admin/actions'
import { toast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function OrderActions({ 
  orderId, 
  canFulfill, 
  canRefund 
}: { 
  orderId: string
  canFulfill: boolean
  canRefund: boolean 
}) {
  const [loading, setLoading] = useState(false)
  const [fulfillOpen, setFulfillOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  async function handleFulfill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.append('order_id', orderId)

    const result = await fulfillOrder(formData)
    setLoading(false)

    if (result.success) {
      toast.add({ title: 'Order fulfilled successfully' })
      setFulfillOpen(false)
    } else {
      toast.add({ title: 'Failed to fulfill order', description: result.error, type: 'error' })
    }
  }

  async function handleRefund(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.append('order_id', orderId)

    const result = await initiateRefundAction(formData)
    setLoading(false)

    if (result.success) {
      toast.add({ title: 'Refund initiated successfully' })
      setRefundOpen(false)
    } else {
      toast.add({ title: 'Failed to initiate refund', description: result.error, type: 'error' })
    }
  }

  return (
    <div className="space-y-3">
      <Dialog open={fulfillOpen} onOpenChange={setFulfillOpen}>
        <DialogTrigger render={<Button className="w-full" disabled={!canFulfill} />}>
          Mark Fulfilled
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleFulfill}>
            <DialogHeader>
              <DialogTitle>Confirm Fulfillment</DialogTitle>
              <DialogDescription>
                Are you sure you want to mark this order as fulfilled? This will update the status and notify the customer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setFulfillOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Fulfilling...' : 'Confirm Fulfillment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogTrigger render={<Button variant="destructive" className="w-full" disabled={!canRefund} />}>
          Initiate Refund
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleRefund}>
            <DialogHeader>
              <DialogTitle>Initiate Refund</DialogTitle>
              <DialogDescription>
                This will process a refund through Stripe and update the order status.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="reason">Reason for Refund</Label>
              <Textarea 
                id="reason" 
                name="reason" 
                required 
                placeholder="Customer requested cancellation, item out of stock, etc." 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRefundOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? 'Initiating...' : 'Confirm Refund'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
