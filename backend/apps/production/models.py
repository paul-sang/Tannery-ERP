from django.db import models
from apps.users.models import User
from apps.inventory.models import Item, StockLot

class ProductionStage(models.Model):
    name = models.CharField(max_length=100)
    sequence_order = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.sequence_order}. {self.name}"

class ProductionProcess(models.Model):
    name = models.CharField(max_length=100)
    stage = models.ForeignKey(ProductionStage, on_delete=models.CASCADE, related_name='processes')
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class ProcessInput(models.Model):
    process = models.ForeignKey(ProductionProcess, on_delete=models.CASCADE, related_name='expected_inputs')
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    expected_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

class ProcessOutput(models.Model):
    process = models.ForeignKey(ProductionProcess, on_delete=models.CASCADE, related_name='expected_outputs')
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    expected_yield_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

class ProcessChemical(models.Model):
    process = models.ForeignKey(ProductionProcess, on_delete=models.CASCADE, related_name='chemicals')
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    quantity_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    sequence_order = models.PositiveIntegerField()
    ph_target = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    temperature_celsius = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField()

class ProductionBatch(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        QA_HOLD = 'QA_HOLD', 'QA Hold'
        COMPLETED = 'COMPLETED', 'Completed'

    batch_number = models.CharField(max_length=100, unique=True)
    process = models.ForeignKey(ProductionProcess, on_delete=models.PROTECT)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='managed_batches')

    def __str__(self):
        return f"Batch {self.batch_number} - {self.process.name}"

class BatchInput(models.Model):
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='inputs')
    stock_lot = models.ForeignKey(StockLot, on_delete=models.PROTECT)
    quantity_weight = models.DecimalField(max_digits=12, decimal_places=2)
    hide_count = models.PositiveIntegerField()

class BatchOutput(models.Model):
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='outputs')
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    hide_count = models.PositiveIntegerField()

class BatchChemicalUsage(models.Model):
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='chemical_usage')
    stock_lot = models.ForeignKey(StockLot, on_delete=models.PROTECT)
    planned_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    actual_quantity = models.DecimalField(max_digits=12, decimal_places=2)
