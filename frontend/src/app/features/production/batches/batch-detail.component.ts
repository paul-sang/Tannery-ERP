import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductionService, BatchSummary, ProductionBatch } from '../../../core/api/production.service';
import { InventoryService } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map } from 'rxjs';

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './batch-detail.component.html'
})
export class BatchDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productionService = inject(ProductionService);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  batchId = 0;
  summary = signal<BatchSummary | null>(null);
  isLoading = signal(true);

  // Consume / Produce modes
  isConsumeMode = signal(false);
  isProduceMode = signal(false);
  isConsumeInputsMode = signal(false);
  consumeForm: FormGroup;
  produceForm: FormGroup;
  consumeInputsForm: FormGroup;
  allItems: any[] = [];
  filteredItems = signal<any[]>([]);
  activeSearchCtx = signal<{ form: string; index: number } | null>(null);
  availableLotsMap = signal<Record<number, any[]>>({});
  isSubmitting = false;

  // Custom Action Modal
  actionModal = signal<{
    isOpen: boolean,
    title: string,
    message: string,
    actions: { label: string, cssClass: string, handler: () => void }[]
  }>({ isOpen: false, title: '', message: '', actions: [] });

  constructor() {
    this.consumeForm = this.fb.group({ lines: this.fb.array([]) });
    this.produceForm = this.fb.group({ lines: this.fb.array([]) });
    this.consumeInputsForm = this.fb.group({ lines: this.fb.array([]) });
  }

  get consumeLines(): FormArray { return this.consumeForm.get('lines') as FormArray; }
  get produceLines(): FormArray { return this.produceForm.get('lines') as FormArray; }
  get consumeInputLines(): FormArray { return this.consumeInputsForm.get('lines') as FormArray; }

  ngOnInit() {
    this.batchId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSummary();
    this.inventoryService.getItems(1, 200).subscribe(res => {
      this.allItems = res.results.filter((i: any) => i.status === 'ACTIVE');
    });
  }

  loadSummary() {
    this.isLoading.set(true);
    this.productionService.batchSummary(this.batchId).subscribe({
      next: (data) => { this.summary.set(data); this.isLoading.set(false); },
      error: () => { this.toastService.error('Error', 'Failed to load batch summary.'); this.isLoading.set(false); }
    });
  }

  goBack() { this.router.navigate(['/production/batches']); }

  closeActionModal() {
    this.actionModal.update(m => ({ ...m, isOpen: false }));
  }

  // --- Status controls ---
  updateStatus(newStatus: string) {
    this.productionService.updateBatchStatus(this.batchId, newStatus).subscribe({
      next: () => {
        this.toastService.success('Status Updated', `Batch moved to ${newStatus.replace('_', ' ')}.`);
        this.loadSummary();
      },
      error: () => this.toastService.error('Error', 'Failed to update status.')
    });
  }

  getDocumentType(doc: any): 'INPUT' | 'CHEMICAL' | 'OUTPUT' {
    if (doc.document_type === 'PRODUCTION_OUTPUT') return 'OUTPUT';
    // For consumption, we check the lines to see if it consumes Raw Hides
    const hasRawHide = doc.lines?.some((l: any) => l.item_details?.category_details?.name === 'RAW_HIDE');
    return hasRawHide ? 'INPUT' : 'CHEMICAL';
  }

  voidDocument(docId: number) {
    this.actionModal.set({
      isOpen: true,
      title: 'Anular Documento',
      message: '¿Estás seguro de anular este documento? Las cantidades descontadas volverán a su estado anterior en el inventario.',
      actions: [
        { label: 'Cancelar', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg cursor-pointer transition', handler: () => this.closeActionModal() },
        { label: 'Sí, Anular', cssClass: 'px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-danger/90 cursor-pointer transition', handler: () => {
            this.closeActionModal();
            this.inventoryService.voidDocument(docId).subscribe({
              next: (res) => {
                this.toastService.success('Anulado', res.detail);
                this.loadSummary();
              },
              error: (err) => {
                this.toastService.error('Error', err.error?.detail || 'Fallo al anular el documento.');
              }
            });
        }}
      ]
    });
  }

  confirmComplete() {
    const sum = this.summary();
    if (!sum) return;
    
    // Evaluate missing items
    const hasInputs = sum.recipe.expected_inputs.length > 0;
    const hasChemicals = sum.recipe.chemicals.some((c: any) => !!c.item);
    const hasOutputs = sum.recipe.expected_outputs.length > 0;

    let consumedInputs = true;
    if (hasInputs) {
      consumedInputs = sum.consumption_documents.some((doc: any) => 
        doc.status !== 'VOIDED' && doc.lines.some((line: any) => line.item_details?.category_details?.name === 'RAW_HIDE')
      );
    }

    let consumedChemicals = true;
    if (hasChemicals) {
      consumedChemicals = sum.consumption_documents.some((doc: any) => 
        doc.status !== 'VOIDED' && doc.lines.some((line: any) => line.item_details?.category_details?.name === 'CHEMICAL')
      );
    }

    const hasOutputDocs = sum.output_documents.some((doc: any) => doc.status !== 'VOIDED');

    const missingInputs = hasInputs && !consumedInputs;
    const missingConsumptions = hasChemicals && !consumedChemicals;
    const missingOutputs = hasOutputs && !hasOutputDocs;

    if (missingInputs || missingConsumptions || missingOutputs) {
      let missingText = '<ul class="list-disc pl-5 mt-2 mb-4 space-y-1 text-text-muted">';
      if (missingInputs) missingText += '<li>Entradas iniciales (materias primas)</li>';
      if (missingConsumptions) missingText += '<li>Químicos requeridos por la fórmula</li>';
      if (missingOutputs) missingText += '<li>Salidas (productos finales esperados)</li>';
      missingText += '</ul>';

      let actions = [
        { label: 'Cancelar', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg cursor-pointer transition', handler: () => this.closeActionModal() },
        { label: 'Forzar Completado', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-warning/20 border border-warning/30 rounded-lg hover:bg-warning/30 cursor-pointer transition', handler: () => {
          this.closeActionModal();
          this.updateStatus('COMPLETED');
        }}
      ];

      if (!missingInputs) {
        actions.push({ label: 'Auto-registrar y Completar', cssClass: 'px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 cursor-pointer transition', handler: () => {
          this.closeActionModal();
          this.autoCompleteBatch(missingInputs, missingConsumptions, missingOutputs);
        }});
      } else {
        missingText += '<div class="mt-3 text-xs text-danger font-semibold bg-danger/10 p-2 rounded border border-danger/20">Nota: No se puede auto-completar porque las Entradas Iniciales (pieles) requieren especificar el lote exacto manualmente mediante el botón "📥 Record Inputs".</div>';
      }

      this.actionModal.set({
        isOpen: true,
        title: 'Completar Lote (Faltan Registros)',
        message: `El sistema ha detectado que faltan los siguientes registros esperados según la receta:${missingText}<p class="font-medium text-warning-foreground mt-2">¿Qué deseas hacer?</p>`,
        actions: actions
      });
    } else {
      this.actionModal.set({
        isOpen: true,
        title: 'Completar Lote',
        message: 'Todos los registros parecen estar en orden. ¿Deseas marcar este lote como completado?',
        actions: [
          { label: 'Cancelar', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg cursor-pointer transition', handler: () => this.closeActionModal() },
          { label: 'Sí, Completar', cssClass: 'px-4 py-2 text-sm font-medium text-white bg-success rounded-lg hover:bg-success/90 cursor-pointer transition', handler: () => {
            this.closeActionModal();
            this.updateStatus('COMPLETED');
          }}
        ]
      });
    }
  }

  autoCompleteBatch(missingInputs: boolean, missingConsumptions: boolean, missingOutputs: boolean) {
    this.isLoading.set(true);
    const sum = this.summary();
    const baseWeight = Number(sum?.batch.base_weight || 0);

    if (missingInputs) {
      this.toastService.show('warning', 'Aviso', 'Las entradas iniciales no se auto-completaron por requerir selección manual de lote.');
    }

    const produceLines: any[] = [];
    if (missingOutputs) {
      let outCounter = 1;
      sum?.recipe.expected_outputs.forEach((out: any) => {
        if (out.item && out.expected_yield_percentage) {
          const isPieces = out.item_details?.category_details?.name === 'FINISHED_LEATHER' || out.item_details?.category_details?.name === 'RAW_HIDE';
          const maxQty = isPieces ? Math.floor((Number(out.expected_yield_percentage) / 100) * Number(sum.batch.quantity_hides)) : Number(((Number(out.expected_yield_percentage) / 100) * baseWeight).toFixed(2));
          produceLines.push({
            item: out.item,
            movement_type: 'IN',
            quantity: maxQty > 0 ? maxQty : 1,
            lot_tracking_number: out.item_details?.track_by_lot ? `${sum.batch.batch_number}-OUT-${String(outCounter++).padStart(2, '0')}` : '',
            notes: 'Auto-generado teóricamente (Salida)'
          });
        }
      });
    }

    const consumeLines: any[] = [];
    if (missingConsumptions && sum?.recipe.chemicals) {
      const chemReqs = sum.recipe.chemicals.filter((c: any) => c.item && c.quantity_percentage).map((chem: any) => {
        const qty = Number(((Number(chem.quantity_percentage) / 100) * baseWeight).toFixed(2));
        return { ...chem, requiredQty: qty };
      });

      let hasStockError = false;
      let stockErrorMessage = '';
      for (const chem of chemReqs) {
        if (chem.requiredQty > (chem.item_details?.current_stock || 0)) {
          hasStockError = true;
          stockErrorMessage = `Stock insuficiente para: ${chem.item_details?.name}. Se requieren ${chem.requiredQty}, pero hay ${chem.item_details?.current_stock || 0}.`;
          break;
        }
      }

      if (hasStockError) {
        this.toastService.error('Error de Stock', stockErrorMessage);
        this.isLoading.set(false);
        return;
      }

      const trackedChems = chemReqs.filter((c: any) => c.item_details?.track_by_lot);
      if (trackedChems.length > 0) {
        const fetchObservables = trackedChems.map((chem: any) => 
          this.inventoryService.getStockLots(1, 100, chem.item, 'AVAILABLE', 'created_at').pipe(map(res => ({ id: chem.item, lots: res.results })))
        );
        
        forkJoin(fetchObservables).subscribe({
          next: (lotResults) => {
             const lotMap: Record<number, any[]> = {};
             lotResults.forEach(r => lotMap[r.id] = r.lots);
             
             let distributionError = false;
             for (const chem of chemReqs) {
               if (chem.item_details?.track_by_lot) {
                 let remainingQty = chem.requiredQty;
                 const lots = lotMap[chem.item] || [];
                 for (const lot of lots) {
                   if (remainingQty <= 0) break;
                   const available = Number(lot.current_primary_quantity);
                   if (available <= 0) continue;
                   const take = Math.min(available, remainingQty);
                   consumeLines.push({
                     item: chem.item,
                     movement_type: 'OUT',
                     quantity: Number(take.toFixed(2)),
                     lot_tracking_number: lot.lot_tracking_number,
                     notes: 'Auto-generado (FIFO)',
                     _category: 'CHEMICAL'
                   });
                   remainingQty -= take;
                 }
                 if (remainingQty > 0.01) {
                   distributionError = true;
                   this.toastService.error('Error de Lote', `Lotes insuficientes configurados para cubrir el total de ${chem.item_details?.name}`);
                   break;
                 }
               } else {
                 consumeLines.push({
                   item: chem.item,
                   movement_type: 'OUT',
                   quantity: chem.requiredQty,
                   lot_tracking_number: '',
                   notes: 'Auto-generado (Químico)',
                   _category: 'CHEMICAL'
                 });
               }
             }

             if (distributionError) {
               this.isLoading.set(false);
               return;
             }
             this.dispatchAutoCompleteTasks(consumeLines, produceLines);
          },
          error: () => {
             this.toastService.error('Error', 'Fallo al obtener lotes para el autocompletado.');
             this.isLoading.set(false);
          }
        });
        return;
      } else {
        chemReqs.forEach((chem: any) => {
          consumeLines.push({
             item: chem.item,
             movement_type: 'OUT',
             quantity: chem.requiredQty,
             lot_tracking_number: '',
             notes: 'Auto-generado (Químico)',
             _category: 'CHEMICAL'
          });
        });
        this.dispatchAutoCompleteTasks(consumeLines, produceLines);
      }
    } else {
      this.dispatchAutoCompleteTasks([], produceLines);
    }
  }

  private dispatchAutoCompleteTasks(consumeLines: any[], produceLines: any[]) {
    const tasks: any[] = [];
    if (consumeLines.length > 0) {
      tasks.push(this.productionService.consumeBatch(this.batchId, consumeLines).toPromise());
    }
    if (produceLines.length > 0) {
      tasks.push(this.productionService.produceBatch(this.batchId, produceLines).toPromise());
    }

    if (tasks.length === 0) {
       this.productionService.updateBatchStatus(this.batchId, 'COMPLETED').subscribe(() => {
          this.toastService.success('Completado', 'Lote completado cerrado sin dependencias extra.');
          this.isLoading.set(false);
          this.loadSummary();
       });
       return;
    }

    Promise.all(tasks).then(() => {
       this.productionService.updateBatchStatus(this.batchId, 'COMPLETED').subscribe(() => {
          this.toastService.success('Completado', 'Lote completado con registros automáticos.');
          this.isLoading.set(false);
          this.loadSummary();
       });
    }).catch(() => {
       this.toastService.error('Error', 'Hubo un error al generar los registros automáticos de inventario.');
       this.isLoading.set(false);
       this.loadSummary();
    });
  }

  confirmCancel() {
    this.actionModal.set({
      isOpen: true,
      title: 'Cancelar Lote',
      message: 'Cancelar este lote <b class="font-semibold text-danger">anulará automáticamente todos los consumos y salidas asociados</b>, devolviendo los ítems al inventario original. ¿Deseas continuar?',
      actions: [
        { label: 'No, regresar', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg cursor-pointer transition', handler: () => this.closeActionModal() },
        { label: 'Sí, Cancelar Lote', cssClass: 'px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-danger/90 cursor-pointer transition', handler: () => {
          this.closeActionModal();
          this.productionService.updateBatchStatus(this.batchId, 'CANCELLED', true).subscribe({
            next: () => {
              this.toastService.success('Cancelado', 'El lote ha sido cancelado y el stock devuelto.');
              this.loadSummary();
            },
            error: () => {
              this.toastService.error('Error', 'Fallo al cancelar el lote.');
              this.loadSummary();
            }
          });
        }}
      ]
    });
  }

  reopenBatch() {
    this.actionModal.set({
      isOpen: true,
      title: 'Reabrir Lote Completado',
      message: 'Reabrir este lote lo volverá a poner "En Progreso", permitiéndote anular o registrar nuevos documentos. ¿Deseas continuar?',
      actions: [
        { label: 'Cancelar', cssClass: 'px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg cursor-pointer transition', handler: () => this.closeActionModal() },
        { label: 'Sí, Reabrir', cssClass: 'px-4 py-2 text-sm font-medium text-warning-foreground bg-warning/10 border border-warning/30 rounded-lg hover:bg-warning/20 cursor-pointer transition', handler: () => {
          this.closeActionModal();
          this.updateStatus('IN_PROGRESS');
        }}
      ]
    });
  }

  // --- Consume Grid Mode ---
  toggleConsumeMode() {
    if (this.isConsumeMode()) {
      this.isConsumeMode.set(false);
    } else {
      this.openConsume();
    }
  }

  toggleConsumeInputs() {
    if (this.isConsumeInputsMode()) this.isConsumeInputsMode.set(false);
    else this.openConsumeInputs();
  }

  toggleProduce() {
    if (this.isProduceMode()) this.isProduceMode.set(false);
    else this.openProduce();
  }

  openConsume() {
    this.consumeLines.clear();
    const recipe = this.summary()?.recipe;
    const baseWeight = Number(this.summary()?.batch.base_weight || 0);

    const offset = 0;
    recipe?.chemicals?.forEach(chem => {
      const isInstruction = !chem.item;
      let qty = 0;
      if (!isInstruction && baseWeight && chem.quantity_percentage) {
        qty = (Number(chem.quantity_percentage) / 100) * baseWeight;
      }
      
      this.consumeLines.push(this.createConsumeLine({
        isInstruction: isInstruction,
        item: chem.item,
        itemName: isInstruction ? chem.instruction : chem.item_details?.name,
        trackByLot: chem.item_details?.track_by_lot,
        expectedQty: Number(qty.toFixed(2)),
        currentStock: chem.item_details?.current_stock || 0,
        sequenceOrder: offset + chem.sequence_order,
        duration: chem.duration_minutes,
        categoryName: chem.item_details?.category_details?.name
      }));
    });
    
    this.isConsumeMode.set(true);
  }

  createConsumeLine(data: any): FormGroup {
    return this.fb.group({
      _is_instruction: [data.isInstruction],
      _sequence_order: [data.sequenceOrder],
      item: [data.item],
      _item_name: [data.itemName || ''],
      _track_by_lot: [data.trackByLot || false],
      _expected_qty: [data.expectedQty || 0],
      _current_stock: [data.currentStock || 0],
      _duration: [data.duration || 0],
      _category_name: [data.categoryName || ''],
      quantity: [{ value: data.expectedQty || 0, disabled: data.isInstruction }, [Validators.min(0)]],
      lot_tracking_number: [{ value: '', disabled: data.isInstruction }]
    });
  }

  addExtraConsumeLine() {
    this.consumeLines.push(this.fb.group({
      _is_instruction: [false],
      _sequence_order: ['Extra'],
      item: [null, Validators.required],
      _item_name: [''],
      _track_by_lot: [false],
      _expected_qty: [0],
      _current_stock: [0],
      _duration: [0],
      _category_name: ['OTHER'],
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      lot_tracking_number: ['']
    }));
  }

  // --- Produce modal ---
  openProduce() {
    this.produceLines.clear();
    const recipe = this.summary()?.recipe;
    const batchNo = this.summary()?.batch.batch_number || 'BATCH';
    recipe?.expected_outputs?.forEach((out, idx) => {
      const baseWeight = Number(this.summary()?.batch.base_weight || 0);
      let qty = 0;
      if (baseWeight && out.expected_yield_percentage) {
        qty = (Number(out.expected_yield_percentage) / 100) * baseWeight;
      }
      const lineGroup = this.createLine(out.item, out.item_details?.name || '', out.item_details?.track_by_lot || false, Number(qty.toFixed(2)));
      if (out.item_details?.track_by_lot) {
        lineGroup.patchValue({ lot_tracking_number: `${batchNo}-OUT-${String(idx + 1).padStart(2, '0')}` });
      }
      this.produceLines.push(lineGroup);
    });
    this.isConsumeMode.set(false);
    this.isConsumeInputsMode.set(false);
    this.isProduceMode.set(true);
  }

  // --- Consume Inputs Modal ---
  openConsumeInputs() {
    this.consumeInputLines.clear();
    const recipe = this.summary()?.recipe;
    const baseWeight = Number(this.summary()?.batch.base_weight || 0);
    const inputs = recipe?.expected_inputs || [];
    
    this.isConsumeMode.set(false);
    this.isProduceMode.set(false);
    this.isConsumeInputsMode.set(true);

    const itemIds = [...new Set(inputs.map(inp => inp.item))].filter(id => id);
    if (itemIds.length > 0) {
      this.isLoading.set(true);
      const reqs = itemIds.map(id => this.inventoryService.getStockLots(1, 100, id, 'AVAILABLE', 'created_at').pipe(map(res => ({id, lots: res.results}))));
      forkJoin(reqs).subscribe({
        next: (results) => {
          const newMap = { ...this.availableLotsMap() };
          results.forEach(r => newMap[r.id!] = r.lots);
          this.availableLotsMap.set(newMap);
          this.populateInputLines(inputs, baseWeight);
          this.isLoading.set(false);
        },
        error: () => {
          this.toastService.error('Error', 'Failed to load available lots for inputs.');
          this.populateInputLines(inputs, baseWeight);
          this.isLoading.set(false);
        }
      });
    } else {
      this.populateInputLines(inputs, baseWeight);
    }
  }

  private populateInputLines(inputs: any[], baseWeight: number) {
    inputs.forEach((inp, idx) => {
      let qty = 0;
      if (baseWeight && inp.expected_percentage) {
        qty = (Number(inp.expected_percentage) / 100) * baseWeight;
      }
      this.consumeInputLines.push(this.createLine(inp.item ? Number(inp.item) : undefined, inp.item_details?.name || '', inp.item_details?.track_by_lot || false, Number(qty.toFixed(2)), false, '', String(idx+1), Number(inp.item_details?.current_stock || 0)));
    });
  }

  createLine(itemId?: number, itemName?: string, trackByLot?: boolean, quantity: number = 0, isInstruction: boolean = false, instruction: string = '', sequenceOrder: string | number = '', currentStock: number = 0): FormGroup {
    return this.fb.group({
      item: [itemId || null, Validators.required],
      _item_name: [itemName ? `${itemName}` : ''],
      _track_by_lot: [trackByLot || false],
      quantity: [quantity || 0, [Validators.required, Validators.min(0)]],
      lot_tracking_number: [''],
      notes: ['']
    });
  }

  addProduceLine() { 
    const line = this.createLine();
    const batchNo = this.summary()?.batch.batch_number || 'BATCH';
    // Auto-gen lot number placeholder for new lines; user selects item later so we don't know if tracked yet
    line.patchValue({ lot_tracking_number: `${batchNo}-OUT-${String(this.produceLines.length + 1).padStart(2, '0')}` });
    this.produceLines.push(line);
  }
  removeProduceLine(i: number) { this.produceLines.removeAt(i); }
  
  addConsumeInputLine() { this.consumeInputLines.push(this.createLine()); }
  removeConsumeInputLine(i: number) { this.consumeInputLines.removeAt(i); }

  removeConsumeLine(i: number) { this.consumeLines.removeAt(i); }

  // --- Item search ---
  getAvailableLots(itemId: number) {
    if (!itemId) return [];
    return this.availableLotsMap()[itemId] || [];
  }

  onItemSearch(query: string, formType: string, index: number) {
    this.activeSearchCtx.set({ form: formType, index });
    if (!query || query.length < 1) { this.filteredItems.set([]); return; }
    const lower = query.toLowerCase();
    this.filteredItems.set(
      this.allItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(lower) || item.sku.toLowerCase().includes(lower);
        if (!matchesSearch) return false;
        
        const cat = item.category_details?.name;
        if (formType === 'consume') return cat === 'CHEMICAL' || cat === 'SUPPLIES';
        if (formType === 'consumeInputs') return cat === 'RAW_HIDE';
        if (formType === 'produce') return cat === 'FINISHED_LEATHER' || cat === 'RAW_HIDE';
        
        return true;
      }).slice(0, 8)
    );
  }

  selectItem(item: any, formType: string, index: number) {
    let lines: FormArray;
    if (formType === 'consume') lines = this.consumeLines;
    else if (formType === 'consumeInputs') lines = this.consumeInputLines;
    else lines = this.produceLines;
    
    const line = lines.at(index);
    line.patchValue({ 
      item: item.id, 
      _item_name: `${item.sku} - ${item.name}`, 
      _track_by_lot: item.track_by_lot,
      _current_stock: item.current_stock || 0,
      _category_name: item.category_details?.name || 'OTHER'
    });

    if (formType === 'consumeInputs' && item.track_by_lot && !this.availableLotsMap()[item.id]) {
      this.inventoryService.getStockLots(1, 100, item.id, 'AVAILABLE', 'created_at').subscribe(res => {
        const newMap = { ...this.availableLotsMap() };
        newMap[item.id] = res.results;
        this.availableLotsMap.set(newMap);
      });
    }
    
    this.filteredItems.set([]);
    this.activeSearchCtx.set(null);
  }

  clearSearch() { setTimeout(() => { this.filteredItems.set([]); this.activeSearchCtx.set(null); }, 200); }
  isSearchActive(formType: string, index: number): boolean { const c = this.activeSearchCtx(); return c?.form === formType && c?.index === index; }

  // --- Submit consumption ---
  submitConsume() {
    if (this.consumeForm.invalid) return;
    
    const rawLines = this.consumeLines.getRawValue();
    const validLines = rawLines.filter(c => !c._is_instruction && c.item && c.quantity > 0);
    
    if (validLines.length === 0) {
      this.toastService.error('Error', 'No valid items to consume.');
      return;
    }

    const missingLots = validLines.some(c => c._track_by_lot && !c.lot_tracking_number);
    if (missingLots) {
      this.toastService.error('Error de Lote', 'Hay químicos/insumos con trazabilidad obligatoria que no tienen un número de lote especificado.');
      return;
    }

    this.isSubmitting = true;
    

    // Split by category
    const hideLines = validLines.filter(l => l._category_name === 'RAW_HIDE');
    const chemicalLines = validLines.filter(l => l._category_name === 'CHEMICAL');
    const otherLines = validLines.filter(l => l._category_name !== 'RAW_HIDE' && l._category_name !== 'CHEMICAL');

    const tasks: any[] = [];
    const mapToBackend = (linesArray: any[]) => linesArray.map(c => ({
      item: c.item,
      movement_type: 'OUT',
      quantity: c.quantity,
      lot_tracking_number: c.lot_tracking_number || '',
      notes: ''
    }));

    if (hideLines.length > 0) tasks.push(this.productionService.consumeBatch(this.batchId, mapToBackend(hideLines)).toPromise());
    if (chemicalLines.length > 0) tasks.push(this.productionService.consumeBatch(this.batchId, mapToBackend(chemicalLines)).toPromise());
    if (otherLines.length > 0) tasks.push(this.productionService.consumeBatch(this.batchId, mapToBackend(otherLines)).toPromise());

    Promise.all(tasks).then(() => {
        this.toastService.success('Consumos Registrados', 'Se han creado los documentos de consumo correctamente.');
        this.isSubmitting = false;
        this.isConsumeMode.set(false);
        this.loadSummary();
    }).catch(err => {
        this.toastService.error('Error', 'Ocurrió un problema al registrar los consumos. Posible falta de stock o lote inválido.');
        this.isSubmitting = false;
    });
  }

  // --- Submit production ---
  submitProduce() {
    const rawLines = this.produceLines.getRawValue();
    const validLines = rawLines.filter(c => c.item && c.quantity > 0);

    if (validLines.length === 0) {
      this.toastService.error('Error', 'No hay productos de salida válidos con cantidad mayor a cero para registrar.');
      return;
    }

    const missingLots = validLines.some(c => c._track_by_lot && !c.lot_tracking_number);
    if (missingLots) {
      this.toastService.error('Error de Lote', 'Todos los productos de salida con trazabilidad obligatoria requieren un número de lote.');
      return;
    }

    this.isSubmitting = true;
    const lines = validLines.map(c => ({
      item: c.item, movement_type: 'IN', quantity: c.quantity,
      lot_tracking_number: c.lot_tracking_number || '', notes: c.notes || ''
    }));
    this.productionService.produceBatch(this.batchId, lines).subscribe({
      next: () => {
        this.toastService.success('Output Recorded', 'Products successfully generated.');
        this.isSubmitting = false;
        this.isProduceMode.set(false);
        this.loadSummary();
      },
      error: (err: any) => {
        this.toastService.error('Error', err.error?.detail || 'Failed to record output.');
        this.isSubmitting = false;
      }
    });
  }

  // --- Submit missing inputs ---
  submitConsumeInputs() {
    const rawLines = this.consumeInputLines.getRawValue();
    const validLines = rawLines.filter(c => c.item && c.quantity > 0);

    if (validLines.length === 0) {
      this.toastService.error('Error', 'No hay ítems registrados con cantidad mayor a cero para confirmar.');
      return;
    }
    
    // Validations
    const missingLots = validLines.some(c => c._track_by_lot && !c.lot_tracking_number);
    if (missingLots) {
      this.toastService.error('Error de Lote', 'Hay ítems con trazabilidad obligatoria sin lote seleccionado.');
      return;
    }
    
    const selectedLots = validLines.map(c => c.lot_tracking_number).filter(l => l);
    const uniqueLots = new Set(selectedLots);
    if (uniqueLots.size !== selectedLots.length) {
      this.toastService.error('Error de Duplicidad', 'Has seleccionado el mismo lote más de una vez. Agrupa las cantidades en una sola línea.');
      return;
    }

    let stockExceeded = false;
    let exceededLot = '';
    validLines.forEach(c => {
      if (c._track_by_lot && c.lot_tracking_number) {
        const lot = this.getAvailableLots(c.item)?.find(l => l.lot_tracking_number === c.lot_tracking_number);
        if (lot && c.quantity > lot.current_primary_quantity) {
          stockExceeded = true;
          exceededLot = lot.lot_tracking_number;
        }
      }
    });

    if (stockExceeded) {
      this.toastService.error('Stock Insuficiente', `La cantidad a consumir supera el stock actual del lote ${exceededLot}.`);
      return;
    }

    this.isSubmitting = true;
    const lines = validLines.map(c => ({
      item: c.item, movement_type: 'OUT', quantity: c.quantity,
      lot_tracking_number: c.lot_tracking_number || '', notes: c.notes || ''
    }));
    this.productionService.consumeBatch(this.batchId, lines).subscribe({
      next: (res: any) => {
        this.toastService.success('Inputs Recorded', 'Raw materials properly allocated and consumed.');
        this.isSubmitting = false;
        this.isConsumeInputsMode.set(false);
        this.loadSummary();
      },
      error: (err: any) => {
        this.toastService.error('Error', err.error?.detail || 'Failed to record inputs.');
        this.isSubmitting = false;
      }
    });
  }

  getCurrentInputTotalQty(): number {
    return this.consumeInputLines.controls.reduce((s, c) => s + (Number(c.value.quantity) || 0), 0);
  }

  getHistoricallyEnteredInputs(): number {
    const sum = this.summary();
    if (!sum) return 0;
    let total = 0;
    sum.consumption_documents?.filter((d: any) => d.status !== 'VOIDED').forEach((doc: any) => {
      doc.lines?.forEach((line: any) => {
        if (line.item_details?.category_details?.name === 'RAW_HIDE') {
          total += Number(line.quantity) || 0;
        }
      });
    });
    return total;
  }

  getExpectedInputQty(): number {
    const sum = this.summary();
    if (!sum) return 0;
    const batchQty = Number(sum.batch.quantity_hides) || 0;
    const baseWeight = Number(sum.batch.base_weight) || 0;
    
    let totalExpected = 0;
    sum.recipe.expected_inputs.forEach((inp: any) => {
      const cat = inp.item_details?.category_details?.name;
      const isPieces = cat === 'FINISHED_LEATHER' || cat === 'RAW_HIDE' || cat === 'SEMI_FINISHED_LEATHER';
      const pct = Number(inp.expected_percentage) || 0;
      if (isPieces) {
         totalExpected += Math.floor((pct / 100) * batchQty);
      } else {
         totalExpected += Number(((pct / 100) * baseWeight).toFixed(2));
      }
    });
    return totalExpected > 0 ? totalExpected : batchQty;
  }

  isInputQtyMismatch(): boolean {
    const current = this.getCurrentInputTotalQty();
    const historical = this.getHistoricallyEnteredInputs();
    const total = current + historical;
    const expected = this.getExpectedInputQty();
    
    if (expected === 0 && total === 0) return false;
    return Math.abs(total - expected) > 0.01;
  }

  getCurrentOutputTotalQty(): number {
    return this.produceLines.controls.reduce((s, c) => s + (Number(c.value.quantity) || 0), 0);
  }

  getHistoricallyEnteredOutputs(): number {
    const sum = this.summary();
    if (!sum) return 0;
    let total = 0;
    sum.output_documents?.filter((d: any) => d.status !== 'VOIDED').forEach((doc: any) => {
      doc.lines?.forEach((line: any) => {
        total += Number(line.quantity) || 0;
      });
    });
    return total;
  }

  getExpectedOutputQty(): number {
    const sum = this.summary();
    if (!sum) return 0;
    const batchQty = Number(sum.batch.quantity_hides) || 0;
    const baseWeight = Number(sum.batch.base_weight) || 0;
    
    let totalExpected = 0;
    sum.recipe.expected_outputs.forEach((out: any) => {
      const cat = out.item_details?.category_details?.name;
      const isPieces = cat === 'FINISHED_LEATHER' || cat === 'RAW_HIDE' || cat === 'SEMI_FINISHED_LEATHER';
      const pct = Number(out.expected_yield_percentage) || 0;
      if (isPieces) {
         totalExpected += Math.floor((pct / 100) * batchQty);
      } else {
         totalExpected += Number(((pct / 100) * baseWeight).toFixed(2));
      }
    });

    return totalExpected;
  }

  isOutputQtyMismatch(): boolean {
    const current = this.getCurrentOutputTotalQty();
    const historical = this.getHistoricallyEnteredOutputs();
    const total = current + historical;
    const expected = this.getExpectedOutputQty();
    
    if (expected === 0 && total === 0) return false;
    return Math.abs(total - expected) > 0.01;
  }

  isInputLineOverStock(index: number): boolean {
    const line = this.consumeInputLines.at(index);
    if (!line || !line.value._track_by_lot || !line.value.lot_tracking_number) return false;
    const lot = this.getAvailableLots(line.value.item)?.find(l => l.lot_tracking_number === line.value.lot_tracking_number);
    return lot ? line.value.quantity > lot.current_primary_quantity : false;
  }

  fillMaxStock(index: number) {
    const line = this.consumeInputLines.at(index);
    if (!line || !line.value._track_by_lot || !line.value.lot_tracking_number) return;
    const lot = this.getAvailableLots(line.value.item)?.find(l => l.lot_tracking_number === line.value.lot_tracking_number);
    if (lot) {
      line.patchValue({ quantity: Math.floor(Number(lot.current_primary_quantity)) });
    }
  }
}

