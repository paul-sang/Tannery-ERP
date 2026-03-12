import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker

from apps.users.models import User
from apps.inventory.models import ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement
from apps.purchases.models import Supplier, PurchaseOrder, PurchaseOrderDetail
from apps.production.models import (ProductionStage, ProductionProcess, ProcessInput, 
                                    ProcessOutput, ProcessChemical, ProductionBatch, 
                                    BatchInput, BatchOutput, BatchChemicalUsage)
from apps.sales.models import Customer, SalesOrder, SalesOrderDetail

class Command(BaseCommand):
    help = 'Seeds the database with realistic test data for the Tannery ERP'

    def add_arguments(self, parser):
        parser.add_argument('--users', type=int, default=5, help='Number of users to generate')
        parser.add_argument('--items', type=int, default=20, help='Number of items to generate')
        parser.add_argument('--purchases', type=int, default=10, help='Number of purchase orders to generate')
        parser.add_argument('--recipes', type=int, default=5, help='Number of production recipes')
        parser.add_argument('--batches', type=int, default=10, help='Number of production batches')
        parser.add_argument('--sales', type=int, default=15, help='Number of sales orders')

    @transaction.atomic
    def handle(self, *args, **options):
        fake = Faker()
        
        self.stdout.write(self.style.SUCCESS("Starting DB Seeder..."))
        
        self.seed_users(fake, options['users'])
        self.seed_core_inventory(fake, options['items'])
        self.seed_purchases(fake, options['purchases'])
        self.seed_production_recipes(fake, options['recipes'])
        self.seed_production_batches(fake, options['batches'])
        self.seed_sales(fake, options['sales'])
        
        self.stdout.write(self.style.SUCCESS("Database seeded successfully!"))

    def seed_users(self, fake, count):
        self.stdout.write("Seeding Users...")
        roles = [r[0] for r in User.Role.choices]
        
        # Ensure at least one admin
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@example.com', 'admin123', role=User.Role.ADMIN)

        for _ in range(count):
            username = fake.unique.user_name()
            if not User.objects.filter(username=username).exists():
                User.objects.create_user(
                    username=username,
                    email=fake.email(),
                    password='tannery123',
                    first_name=fake.first_name(),
                    last_name=fake.last_name(),
                    role=random.choice(roles)
                )

    def seed_core_inventory(self, fake, items_count):
        self.stdout.write("Seeding Inventory Core...")
        
        # Categories
        cat_map = {}
        for code, name in ProductCategory.CATEGORY_CHOICES:
            cat_map[code], _ = ProductCategory.objects.get_or_create(name=code, defaults={'description': f'{name} category'})

        uoms = {
            'kg': UnitOfMeasure.objects.get_or_create(name='Kilograms', abbreviation='kg')[0],
            'pieces': UnitOfMeasure.objects.get_or_create(name='Pieces', abbreviation='pcs')[0],
            'sqft': UnitOfMeasure.objects.get_or_create(name='Square Feet', abbreviation='sqft')[0],
            'liters': UnitOfMeasure.objects.get_or_create(name='Liters', abbreviation='L')[0]
        }

        # Items
        for i in range(items_count):
            cat_code = random.choice(list(cat_map.keys()))
            cat_obj = cat_map[cat_code]
            
            uom_primary = uoms['kg'] if cat_code in ['CHEMICAL', 'RAW_HIDE'] else uoms['sqft']
            uom_secondary = uoms['pieces'] if cat_code in ['RAW_HIDE', 'FINISHED_LEATHER'] else None

            Item.objects.get_or_create(
                sku=f"ITM-{fake.unique.random_int(min=1000, max=9999)}",
                defaults={
                    'name': f"{cat_code.replace('_', ' ').title()} - {fake.word().capitalize()}",
                    'category': cat_obj,
                    'uom': uom_primary,
                    'secondary_uom': uom_secondary,
                    'min_stock_level': Decimal(random.randint(50, 200))
                }
            )

    def seed_purchases(self, fake, count):
        self.stdout.write("Seeding Purchases & Initial Stock...")
        
        suppliers = []
        for _ in range(5):
            sup, _ = Supplier.objects.get_or_create(
                name=fake.company(),
                defaults={'contact_info': fake.address(), 'tax_id': fake.ean13()}
            )
            suppliers.append(sup)

        raw_items = list(Item.objects.filter(category__name__in=['RAW_HIDE', 'CHEMICAL']))
        if not raw_items:
            return

        for _ in range(count):
            po = PurchaseOrder.objects.create(
                order_number=f"PO-{fake.unique.random_int(min=1000, max=9999)}",
                supplier=random.choice(suppliers),
                status=PurchaseOrder.Status.RECEIVED,
                total_amount=Decimal(random.randint(1000, 15000))
            )

            for _ in range(random.randint(1, 4)):
                item = random.choice(raw_items)
                qty = Decimal(random.randint(100, 5000))
                
                pod = PurchaseOrderDetail.objects.create(
                    purchase_order=po,
                    item=item,
                    quantity=qty,
                    secondary_quantity=Decimal(int(qty/10)) if item.secondary_uom else None,
                    unit_price=Decimal(random.uniform(1.0, 50.0))
                )

                # Receive it directly into a Stock Lot
                StockLot.objects.create(
                    item=item,
                    lot_tracking_number=f"LOT-PO-{po.order_number}-{pod.id}",
                    source_purchase_detail=pod,
                    current_primary_quantity=qty,
                    current_secondary_quantity=pod.secondary_quantity
                )

    def seed_production_recipes(self, fake, count):
        self.stdout.write("Seeding Production Recipes...")
        stages = [
            ProductionStage.objects.get_or_create(name="Soaking & Liming", sequence_order=1)[0],
            ProductionStage.objects.get_or_create(name="Tanning (Wet Blue)", sequence_order=2)[0],
            ProductionStage.objects.get_or_create(name="Dyeing & Crust", sequence_order=3)[0],
            ProductionStage.objects.get_or_create(name="Finishing", sequence_order=4)[0]
        ]

        raw_hides = list(Item.objects.filter(category__name='RAW_HIDE'))
        chemicals = list(Item.objects.filter(category__name='CHEMICAL'))
        finished = list(Item.objects.filter(category__name='FINISHED_LEATHER'))
        
        if not (raw_hides and chemicals and finished):
            return

        for _ in range(count):
            stage = random.choice(stages)
            process = ProductionProcess.objects.create(
                name=f"Recipe: {stage.name} - Variant {random.randint(1, 99)}",
                stage=stage,
                description=fake.catch_phrase()
            )

            ProcessInput.objects.create(process=process, item=random.choice(raw_hides), expected_percentage=Decimal('100.00'))
            ProcessOutput.objects.create(process=process, item=random.choice(finished), expected_yield_percentage=Decimal('90.00'))
            
            for i in range(random.randint(1, 3)):
                ProcessChemical.objects.create(
                    process=process,
                    item=random.choice(chemicals),
                    quantity_percentage=Decimal(random.uniform(0.5, 5.0)),
                    sequence_order=i+1,
                    duration_minutes=random.randint(30, 240)
                )

    def seed_production_batches(self, fake, count):
        self.stdout.write("Seeding Production Batches...")
        processes = list(ProductionProcess.objects.all())
        raw_lots = list(StockLot.objects.filter(item__category__name='RAW_HIDE', current_primary_quantity__gt=0))
        managers = list(User.objects.filter(role=User.Role.PRODUCTION_MANAGER)) or list(User.objects.all())

        if not (processes and raw_lots):
            return

        for _ in range(count):
            process = random.choice(processes)
            batch = ProductionBatch.objects.create(
                batch_number=f"BAT-{fake.unique.random_int(min=1000, max=9999)}",
                process=process,
                status=ProductionBatch.Status.COMPLETED,
                manager=random.choice(managers)
            )

            # Consume raw lot
            lot = random.choice(raw_lots)
            consumed_qty = min(lot.current_primary_quantity, Decimal(random.randint(50, 500)))
            lot.current_primary_quantity -= consumed_qty
            lot.save()

            BatchInput.objects.create(
                batch=batch,
                stock_lot=lot,
                quantity_weight=consumed_qty,
                hide_count=int(consumed_qty/10)
            )

            # Produce finished lot
            output_item = process.expected_outputs.first().item if process.expected_outputs.exists() else None
            if output_item:
                yield_qty = consumed_qty * Decimal('0.9') # 90% yield
                
                new_lot = StockLot.objects.create(
                    item=output_item,
                    lot_tracking_number=f"LOT-BAT-{batch.batch_number}",
                    source_batch=batch,
                    current_primary_quantity=yield_qty,
                    current_secondary_quantity=Decimal(int(yield_qty/10))
                )

                BatchOutput.objects.create(
                    batch=batch, 
                    item=output_item,
                    quantity=yield_qty,
                    hide_count=int(yield_qty/10)
                )

    def seed_sales(self, fake, count):
        self.stdout.write("Seeding Sales...")
        customers = []
        for _ in range(5):
            cust, _ = Customer.objects.get_or_create(
                name=fake.company(),
                defaults={'contact_info': fake.address(), 'tax_id': fake.ean13()}
            )
            customers.append(cust)

        finished_lots = list(StockLot.objects.filter(item__category__name='FINISHED_LEATHER', current_primary_quantity__gt=0))
        if not finished_lots:
            return

        for _ in range(count):
            so = SalesOrder.objects.create(
                order_number=f"SO-{fake.unique.random_int(min=1000, max=9999)}",
                customer=random.choice(customers),
                status=SalesOrder.Status.SHIPPED,
                total_amount=Decimal(random.randint(5000, 30000))
            )

            lot = random.choice(finished_lots)
            qty_sold = min(lot.current_primary_quantity, Decimal(random.randint(50, 200)))
            if qty_sold <= 0: continue

            lot.current_primary_quantity -= qty_sold
            lot.save()

            SalesOrderDetail.objects.create(
                sales_order=so,
                stock_lot=lot,
                quantity=qty_sold,
                unit_price=Decimal(random.uniform(5.0, 15.0))
            )
