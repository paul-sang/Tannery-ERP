from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum
from .models import StockMovement, Item, StockLot

def update_stock_balances(item_id, stock_lot_id=None):
    if not item_id:
        return
        
    from django.db.models import Q
    item = Item.objects.get(id=item_id)
    
    # Recalculate Item total stock (atomic ledger aggregation)
    # Match movements explicitly linked to the item OR linked to a lot of this item
    in_qty = StockMovement.objects.filter(Q(item=item) | Q(stock_lot__item=item), movement_type=StockMovement.MovementType.IN).aggregate(total=Sum('quantity'))['total'] or 0
    adj_qty = StockMovement.objects.filter(Q(item=item) | Q(stock_lot__item=item), movement_type=StockMovement.MovementType.ADJUSTMENT).aggregate(total=Sum('quantity'))['total'] or 0
    out_qty = StockMovement.objects.filter(Q(item=item) | Q(stock_lot__item=item), movement_type=StockMovement.MovementType.OUT).aggregate(total=Sum('quantity'))['total'] or 0
    
    item.current_stock = in_qty + adj_qty - out_qty
    item.save(update_fields=['current_stock'])
    
    # Recalculate Lot stock if applicable
    if stock_lot_id:
        try:
            lot = StockLot.objects.get(id=stock_lot_id)
            lot_in = StockMovement.objects.filter(stock_lot=lot, movement_type=StockMovement.MovementType.IN).aggregate(total=Sum('quantity'))['total'] or 0
            lot_adj = StockMovement.objects.filter(stock_lot=lot, movement_type=StockMovement.MovementType.ADJUSTMENT).aggregate(total=Sum('quantity'))['total'] or 0
            lot_out = StockMovement.objects.filter(stock_lot=lot, movement_type=StockMovement.MovementType.OUT).aggregate(total=Sum('quantity'))['total'] or 0
            
            lot.current_primary_quantity = lot_in + lot_adj - lot_out
            lot.save(update_fields=['current_primary_quantity'])
        except StockLot.DoesNotExist:
            pass

@receiver(post_save, sender=StockMovement)
@receiver(post_delete, sender=StockMovement)
def stock_movement_changed(sender, instance, **kwargs):
    update_stock_balances(instance.item_id, instance.stock_lot_id)
