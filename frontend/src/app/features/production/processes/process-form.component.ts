import { Component, EventEmitter, Input, OnInit, OnChanges, Output, inject, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ProductionService, ProductionProcess, ProductionStage } from '../../../core/api/production.service';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-process-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './process-form.component.html'
})
export class ProcessFormComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private productionService = inject(ProductionService);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() editProcess: ProductionProcess | null = null;
  @Output() closeForm = new EventEmitter<void>();
  @Output() processSaved = new EventEmitter<any>();

  form: FormGroup;
  stages: ProductionStage[] = [];
  allItems: Item[] = [];
  isSubmitting = false;

  // Item search for inline rows
  filteredItems = signal<Item[]>([]);
  activeSearchContext = signal<{ section: string, index: number } | null>(null);

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      stage: [null, Validators.required],
      description: [''],
      is_active: [true],
      expected_inputs: this.fb.array([]),
      expected_outputs: this.fb.array([]),
      chemicals: this.fb.array([])
    });
  }

  get inputs(): FormArray { return this.form.get('expected_inputs') as FormArray; }
  get outputs(): FormArray { return this.form.get('expected_outputs') as FormArray; }
  get chemicals(): FormArray { return this.form.get('chemicals') as FormArray; }

  ngOnInit() {
    this.productionService.getStages(1, 50).subscribe((res) => this.stages = res.results);
    this.inventoryService.getItems(1, 200).subscribe((res) => {
      this.allItems = res.results.filter((i: Item) => i.status === 'ACTIVE');
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editProcess'] && this.editProcess) {
      this.populateForm(this.editProcess);
    } else if (changes['isOpen'] && this.isOpen && !this.editProcess) {
      this.resetForm();
    }
  }

  populateForm(proc: ProductionProcess) {
    this.form.patchValue({
      name: proc.name,
      stage: proc.stage,
      description: proc.description,
      is_active: proc.is_active
    });

    this.inputs.clear();
    proc.expected_inputs?.forEach(inp => {
      this.inputs.push(this.fb.group({
        item: [inp.item, Validators.required],
        _item_name: [inp.item_details?.name || ''],
        expected_percentage: [inp.expected_percentage]
      }));
    });

    this.outputs.clear();
    proc.expected_outputs?.forEach(out => {
      this.outputs.push(this.fb.group({
        item: [out.item, Validators.required],
        _item_name: [out.item_details?.name || ''],
        expected_yield_percentage: [out.expected_yield_percentage]
      }));
    });

    this.chemicals.clear();
    proc.chemicals?.forEach(chem => {
      this.chemicals.push(this.fb.group({
        _is_instruction: [!!chem.instruction],
        item: [chem.item],
        _item_name: [chem.item_details?.name || ''],
        instruction: [chem.instruction || ''],
        quantity_percentage: [chem.quantity_percentage],
        sequence_order: [chem.sequence_order, Validators.required],
        ph_target: [chem.ph_target],
        temperature_celsius: [chem.temperature_celsius],
        duration_minutes: [chem.duration_minutes, Validators.required]
      }));
    });
  }

  resetForm() {
    this.form.reset({ is_active: true });
    this.inputs.clear();
    this.outputs.clear();
    this.chemicals.clear();
  }

  // --- Add/remove rows ---
  addInput() {
    this.inputs.push(this.fb.group({
      item: [null, Validators.required],
      _item_name: [''],
      expected_percentage: [null]
    }));
  }

  addOutput() {
    this.outputs.push(this.fb.group({
      item: [null, Validators.required],
      _item_name: [''],
      expected_yield_percentage: [null]
    }));
  }

  addChemical(isInstruction = false) {
    this.chemicals.push(this.fb.group({
      _is_instruction: [isInstruction],
      item: [null],
      _item_name: [''],
      instruction: [''],
      quantity_percentage: [null],
      sequence_order: [this.chemicals.length + 1, Validators.required],
      ph_target: [null],
      temperature_celsius: [null],
      duration_minutes: [0, Validators.required]
    }));
  }

  removeInput(i: number) { this.inputs.removeAt(i); }
  removeOutput(i: number) { this.outputs.removeAt(i); }
  removeChemical(i: number) { this.chemicals.removeAt(i); }

  // --- Item search for inline rows ---
  onItemSearch(query: string, section: string, index: number) {
    this.activeSearchContext.set({ section, index });
    if (!query || query.length < 1) {
      this.filteredItems.set([]);
      return;
    }
    const lower = query.toLowerCase();
    this.filteredItems.set(
      this.allItems.filter(i => i.sku.toLowerCase().includes(lower) || i.name.toLowerCase().includes(lower)).slice(0, 8)
    );
  }

  selectItem(item: Item, section: string, index: number) {
    let group: FormGroup;
    if (section === 'input') group = this.inputs.at(index) as FormGroup;
    else if (section === 'output') group = this.outputs.at(index) as FormGroup;
    else group = this.chemicals.at(index) as FormGroup;

    group.patchValue({ item: item.id, _item_name: `${item.sku} - ${item.name}` });
    this.filteredItems.set([]);
    this.activeSearchContext.set(null);
  }

  clearSearch() {
    setTimeout(() => {
      this.filteredItems.set([]);
      this.activeSearchContext.set(null);
    }, 200);
  }

  isSearchActive(section: string, index: number): boolean {
    const ctx = this.activeSearchContext();
    return ctx?.section === section && ctx?.index === index;
  }

  // --- Submit ---
  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const raw = this.form.value;

    const payload = {
      name: raw.name,
      stage: raw.stage,
      description: raw.description || '',
      is_active: raw.is_active,
      expected_inputs: raw.expected_inputs.map((r: any) => ({ item: r.item, expected_percentage: r.expected_percentage })),
      expected_outputs: raw.expected_outputs.map((r: any) => ({ item: r.item, expected_yield_percentage: r.expected_yield_percentage })),
      chemicals: raw.chemicals.map((r: any) => ({
        item: r._is_instruction ? null : r.item,
        instruction: r._is_instruction ? r.instruction : null,
        quantity_percentage: r.quantity_percentage,
        sequence_order: r.sequence_order,
        ph_target: r.ph_target,
        temperature_celsius: r.temperature_celsius,
        duration_minutes: r.duration_minutes
      }))
    };

    const obs = this.editProcess
      ? this.productionService.updateProcess(this.editProcess.id, payload)
      : this.productionService.createProcess(payload);

    obs.subscribe({
      next: (res) => {
        this.toastService.success('Success', `Recipe ${this.editProcess ? 'updated' : 'created'} successfully.`);
        this.isSubmitting = false;
        this.resetForm();
        this.processSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        const msg = err.error?.detail || err.error?.name?.[0] || 'Failed to save recipe.';
        this.toastService.error('Error', msg);
        this.isSubmitting = false;
      }
    });
  }
}
