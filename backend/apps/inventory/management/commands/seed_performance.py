"""
Configurable performance test data seed script.

Usage:
    python manage.py seed_performance [--items N] [--lots N] [--documents N] [--batches N] [--reset]

Defaults are moderate (50 items, 200 lots, 100 documents, 20 batches).
For stress testing, use higher values, e.g.:
    python manage.py seed_performance --items 500 --lots 5000 --documents 2000 --batches 200
"""
import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import User
from apps.inventory.models import (
    ProductCategory, UnitOfMeasure, Item, StockLot, StockMovement,
    InventoryDocument, InventoryDocumentLine
)
from apps.production.models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput,
    ProcessChemical, ProductionBatch
)


class Command(BaseCommand):
    help = 'Seed the database with configurable test data for performance testing'

    def add_arguments(self, parser):
        parser.add_argument('--items', type=int, default=50, help='Number of items to create (default: 50)')
        parser.add_argument('--lots', type=int, default=200, help='Number of stock lots (default: 200)')
        parser.add_argument('--documents', type=int, default=100, help='Number of inventory documents (default: 100)')
        parser.add_argument('--batches', type=int, default=20, help='Number of production batches (default: 20)')
        parser.add_argument('--reset', action='store_true', help='Delete ALL existing data before seeding')

    def handle(self, *args, **options):
        n_items = options['items']
        n_docs = options['documents']
        n_batches = options['batches']

        if options['reset']:
            self.stdout.write(self.style.WARNING('Resetting all data...'))
            StockMovement.objects.all().delete()
            InventoryDocumentLine.objects.all().delete()
            InventoryDocument.objects.all().delete()
            StockLot.objects.all().delete()
            ProductionBatch.objects.all().delete()
            ProcessChemical.objects.all().delete()
            ProcessOutput.objects.all().delete()
            ProcessInput.objects.all().delete()
            ProductionProcess.objects.all().delete()
            ProductionStage.objects.all().delete()
            Item.objects.all().delete()
            UnitOfMeasure.objects.all().delete()
            ProductCategory.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('All data deleted.'))

        self.stdout.write(f'\nSeeding: {n_items} items, {n_docs} documents, {n_batches} batches\n')

        # Ensure admin user
        admin, _ = User.objects.get_or_create(username='admin', defaults={
            'email': 'admin@test.com', 'is_superuser': True, 'is_staff': True
        })
        if not admin.has_usable_password():
            admin.set_password('admin123')
            admin.save()

        # --- UOMs ---
        uom_data = [
            ('Kilogram', 'kg'), ('Liter', 'L'), ('Piece', 'pcs'),
            ('Square Foot', 'sqft'), ('Meter', 'm'), ('Gram', 'g')
        ]
        uoms = []
        for name, abbr in uom_data:
            uom, _ = UnitOfMeasure.objects.get_or_create(name=name, defaults={'abbreviation': abbr})
            uoms.append(uom)
        self.stdout.write(f'  ✓ {len(uoms)} UoMs')

        # --- Categories (use model CATEGORY_CHOICES) ---
        cat_map = {}
        for val, label in ProductCategory.CATEGORY_CHOICES:
            cat, _ = ProductCategory.objects.get_or_create(name=val)
            cat_map[val] = cat
        categories = list(cat_map.values())
        self.stdout.write(f'  ✓ {len(categories)} categories')

        # --- Items ---
        raw_hide_names = ['Cowhide Raw', 'Goatskin Raw', 'Sheepskin Raw', 'Buffalo Hide Raw', 'Pigskin Raw']
        chemical_names = ['Chrome Sulfate', 'Sodium Sulfide', 'Lime Powder', 'Formic Acid', 'Sulfuric Acid',
                          'Sodium Chloride', 'Ammonium Sulfate', 'Bating Agent', 'Degreasing Agent', 'Syntans',
                          'Fatliquor A', 'Fatliquor B', 'Retanning Agent', 'Neutralizing Agent', 'Preservative',
                          'Wetting Agent', 'Enzyme Bate', 'Pickling Salt', 'Basifying Agent', 'Anti-mold Agent']
        leather_names = ['Full Grain Leather', 'Top Grain Leather', 'Split Leather', 'Corrected Grain',
                         'Nubuck Leather', 'Suede Leather', 'Patent Leather', 'Aniline Leather']
        supply_names = ['Packaging Box', 'Label Sticker', 'Protective Film', 'Thread Spool', 'Edge Paint']

        items = []
        created = 0
        for i in range(n_items):
            if i < len(raw_hide_names):
                name, cat_key, uom, track = raw_hide_names[i], 'RAW_HIDE', uoms[0], True
            elif i < len(raw_hide_names) + len(chemical_names):
                idx = i - len(raw_hide_names)
                name = chemical_names[idx]
                cat_key = 'CHEMICAL'
                uom = uoms[0] if any(k in name for k in ['Powder', 'Salt', 'Sulfate', 'Sulfide', 'Chloride']) else uoms[1]
                track = False
            elif i < len(raw_hide_names) + len(chemical_names) + len(leather_names):
                idx = i - len(raw_hide_names) - len(chemical_names)
                name, cat_key, uom, track = leather_names[idx], 'FINISHED_LEATHER', uoms[3], True
            elif i < len(raw_hide_names) + len(chemical_names) + len(leather_names) + len(supply_names):
                idx = i - len(raw_hide_names) - len(chemical_names) - len(leather_names)
                name, cat_key, uom, track = supply_names[idx], 'SUPPLIES', uoms[2], False
            else:
                name = f'Item-{i:04d}'
                cat_key = random.choice(list(cat_map.keys()))
                uom = random.choice(uoms)
                track = random.choice([True, False])

            sku = f'SKU-{i:04d}'
            item, was_created = Item.objects.get_or_create(
                sku=sku,
                defaults={
                    'name': name,
                    'category': cat_map[cat_key],
                    'uom': uom,
                    'track_by_lot': track,
                    'status': 'ACTIVE',
                    'min_stock_level': Decimal(random.randint(5, 50)),
                    'current_stock': Decimal('0')
                }
            )
            items.append(item)
            if was_created:
                created += 1

        self.stdout.write(f'  ✓ {created} items created ({len(items)} total available)')

        # --- Production Stages ---
        stage_data = [
            (1, 'Beamhouse'), (2, 'Tanning'), (3, 'Post-Tanning'),
            (4, 'Crusting'), (5, 'Finishing')
        ]
        stages = []
        for order, name in stage_data:
            stage, _ = ProductionStage.objects.get_or_create(name=name, defaults={'sequence_order': order})
            stages.append(stage)
        self.stdout.write(f'  ✓ {len(stages)} production stages')

        # --- Production Processes ---
        process_data = [
            ('Soaking', 0), ('Liming', 0), ('Deliming & Bating', 0),
            ('Pickling', 1), ('Chrome Tanning', 1), ('Vegetable Tanning', 1),
            ('Neutralization', 2), ('Retanning', 2), ('Dyeing', 2), ('Fatliquoring', 2),
            ('Setting Out', 3), ('Drying', 3), ('Staking', 3),
            ('Spraying', 4), ('Ironing & Plating', 4), ('Measuring', 4)
        ]
        processes = []
        chem_items = [it for it in items if it.category.name == 'CHEMICAL']
        raw_items = [it for it in items if it.category.name == 'RAW_HIDE']
        leather_items = [it for it in items if it.category.name == 'FINISHED_LEATHER']

        for proc_name, stage_idx in process_data:
            proc, was_created = ProductionProcess.objects.get_or_create(
                name=proc_name,
                defaults={'stage': stages[stage_idx], 'description': f'{proc_name} process for leather tanning.', 'is_active': True}
            )

            if was_created and chem_items:
                n_chems = random.randint(2, min(4, len(chem_items)))
                for seq, chem_item in enumerate(random.sample(chem_items, n_chems), 1):
                    ProcessChemical.objects.create(
                        process=proc, item=chem_item,
                        quantity_percentage=Decimal(str(round(random.uniform(0.5, 15.0), 2))),
                        sequence_order=seq,
                        ph_target=Decimal(str(round(random.uniform(2.5, 12.0), 1))) if random.random() > 0.3 else None,
                        temperature_celsius=Decimal(str(round(random.uniform(20, 60), 1))) if random.random() > 0.3 else None,
                        duration_minutes=random.choice([15, 30, 45, 60, 90, 120, 180, 240])
                    )

                if raw_items:
                    ProcessInput.objects.create(process=proc, item=random.choice(raw_items), expected_percentage=Decimal('100'))
                if leather_items:
                    ProcessOutput.objects.create(process=proc, item=random.choice(leather_items),
                                                 expected_yield_percentage=Decimal(str(round(random.uniform(60, 95), 1))))

            processes.append(proc)
        self.stdout.write(f'  ✓ {len(processes)} production processes with recipes')

        # --- Inventory Documents ---
        doc_types = ['ADJ', 'PUR', 'INI']
        docs_created = 0
        lots_created = 0
        movements_created = 0

        for d in range(n_docs):
            doc_type = random.choice(doc_types)
            doc = InventoryDocument.objects.create(
                document_number=f'DOC-{timezone.now().strftime("%Y%m%d")}-{d:04d}',
                document_type=doc_type,
                notes=f'Auto-generated {doc_type} document #{d}',
                user=admin
            )
            docs_created += 1

            n_lines = random.randint(1, 5)
            for _ in range(n_lines):
                item = random.choice(items)
                qty = Decimal(str(round(random.uniform(1, 500), 2)))

                line = InventoryDocumentLine.objects.create(
                    document=doc, item=item, movement_type='IN', quantity=qty
                )

                lot = None
                if item.track_by_lot:
                    lot = StockLot.objects.create(
                        item=item,
                        lot_tracking_number=f'LOT-{item.sku}-{random.randint(1000,9999)}',
                        source_document_line=line,
                        current_primary_quantity=qty
                    )
                    lots_created += 1

                StockMovement.objects.create(
                    item=item, stock_lot=lot, movement_type='IN', quantity=qty, document_line=line, user=admin
                )
                movements_created += 1

                item.current_stock += qty
                item.save(update_fields=['current_stock'])

        self.stdout.write(f'  ✓ {docs_created} documents, {lots_created} lots, {movements_created} movements')

        # --- Production Batches ---
        statuses = ['PENDING', 'IN_PROGRESS', 'QA_HOLD', 'COMPLETED']
        batch_count = 0
        for b in range(n_batches):
            proc = random.choice(processes)
            status = random.choice(statuses)
            batch = ProductionBatch.objects.create(
                batch_number=f'BATCH-{timezone.now().strftime("%Y%m%d")}-{b:04d}',
                process=proc,
                status=status,
                manager=admin,
                notes=f'Test batch #{b} for {proc.name}',
                end_date=timezone.now() if status == 'COMPLETED' else None
            )
            batch_count += 1

            if status in ('IN_PROGRESS', 'COMPLETED'):
                cons_doc = InventoryDocument.objects.create(
                    document_number=f'PCN-{timezone.now().strftime("%Y%m%d")}-B{b:04d}',
                    document_type='PCN',
                    production_batch=batch, user=admin
                )
                for ci in range(random.randint(1, 3)):
                    item = random.choice(items)
                    qty = Decimal(str(round(random.uniform(5, 100), 2)))
                    line = InventoryDocumentLine.objects.create(
                        document=cons_doc, item=item, movement_type='OUT', quantity=qty
                    )
                    StockMovement.objects.create(item=item, movement_type='OUT', quantity=qty, document_line=line, user=admin)

            if status == 'COMPLETED' and leather_items:
                out_doc = InventoryDocument.objects.create(
                    document_number=f'POT-{timezone.now().strftime("%Y%m%d")}-B{b:04d}',
                    document_type='POT',
                    production_batch=batch, user=admin
                )
                out_item = random.choice(leather_items)
                qty = Decimal(str(round(random.uniform(50, 300), 2)))
                line = InventoryDocumentLine.objects.create(
                    document=out_doc, item=out_item, movement_type='IN', quantity=qty
                )
                lot = None
                if out_item.track_by_lot:
                    lot = StockLot.objects.create(
                        item=out_item, lot_tracking_number=f'LOT-PROD-{b:04d}',
                        source_document_line=line, current_primary_quantity=qty
                    )
                StockMovement.objects.create(
                    item=out_item, stock_lot=lot, movement_type='IN', quantity=qty, document_line=line, user=admin
                )
                out_item.current_stock += qty
                out_item.save(update_fields=['current_stock'])

        self.stdout.write(f'  ✓ {batch_count} production batches (with consumption/output docs)')

        self.stdout.write(self.style.SUCCESS(f'\n✅ Seed complete! Summary:'))
        self.stdout.write(f'   Items:      {Item.objects.count()}')
        self.stdout.write(f'   Stock Lots: {StockLot.objects.count()}')
        self.stdout.write(f'   Documents:  {InventoryDocument.objects.count()}')
        self.stdout.write(f'   Movements:  {StockMovement.objects.count()}')
        self.stdout.write(f'   Stages:     {ProductionStage.objects.count()}')
        self.stdout.write(f'   Processes:  {ProductionProcess.objects.count()}')
        self.stdout.write(f'   Batches:    {ProductionBatch.objects.count()}')
