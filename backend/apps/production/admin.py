from django.contrib import admin
from .models import (
    ProductionStage, ProductionProcess, ProcessInput, ProcessOutput, 
    ProcessChemical, ProductionBatch, BatchInput, BatchOutput, BatchChemicalUsage
)

# Inline models to make the admin interface for Processes and Batches user-friendly
class ProcessInputInline(admin.TabularInline):
    model = ProcessInput
    extra = 1

class ProcessOutputInline(admin.TabularInline):
    model = ProcessOutput
    extra = 1

class ProcessChemicalInline(admin.TabularInline):
    model = ProcessChemical
    extra = 1

class BatchInputInline(admin.TabularInline):
    model = BatchInput
    extra = 1

class BatchOutputInline(admin.TabularInline):
    model = BatchOutput
    extra = 1

class BatchChemicalUsageInline(admin.TabularInline):
    model = BatchChemicalUsage
    extra = 1

@admin.register(ProductionStage)
class ProductionStageAdmin(admin.ModelAdmin):
    list_display = ('sequence_order', 'name')
    ordering = ('sequence_order',)

@admin.register(ProductionProcess)
class ProductionProcessAdmin(admin.ModelAdmin):
    list_display = ('name', 'stage')
    inlines = [ProcessInputInline, ProcessOutputInline, ProcessChemicalInline]

@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ('batch_number', 'process', 'status', 'start_date', 'manager')
    list_filter = ('status', 'process')
    search_fields = ('batch_number',)
    inlines = [BatchInputInline, BatchOutputInline, BatchChemicalUsageInline]
