import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-adjustment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './adjustment-form.component.html'
})
export class AdjustmentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() documentSaved = new EventEmitter<any>();

  form: FormGroup;
  allItems: Item[] = [];
  filteredItems = signal<Item[]>([]);
  isSubmitting = false;
  activeSearchIndex = signal<number | null>(null);
  searchQuery = signal<string>('');

  documentTypes = [
    { value: 'ADJ', label: 'Adjustment' },
    { value: 'INI', label: 'Initial Balance' },
    { value: 'TRF', label: 'Transfer' }
  ];

  constructor() {
    this.form = this.fb.group({
      document_type: ['ADJ', Validators.required],
      notes: [''],
      lines: this.fb.array([])
    });
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  ngOnInit() {
    this.inventoryService.getItems(1, 200).subscribe((res) => {
      this.allItems = res.results.filter((i: Item) => i.status === 'ACTIVE');
    });
  }

  createLine(): FormGroup {
    return this.fb.group({
      item: [null, Validators.required],
      item_display: [''],
      movement_type: ['IN', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      secondary_quantity: [null],
      lot_tracking_number: [''],
      notes: [''],
      // UI helper fields
      _item_search: [''],
      _is_lot_tracked: [false],
      _uom_label: [''],
      _secondary_uom_label: ['']
    });
  }

  addLine() {
    this.lines.push(this.createLine());
  }

  removeLine(index: number) {
    this.lines.removeAt(index);
  }

  onItemSearch(query: string, lineIndex: number) {
    this.searchQuery.set(query);
    this.activeSearchIndex.set(lineIndex);

    if (!query || query.length < 1) {
      this.filteredItems.set([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = this.allItems.filter(item =>
      item.sku.toLowerCase().includes(lowerQuery) ||
      item.name.toLowerCase().includes(lowerQuery)
    );
    this.filteredItems.set(filtered.slice(0, 10));
  }

  selectItem(item: Item, lineIndex: number) {
    const line = this.lines.at(lineIndex);
    line.patchValue({
      item: item.id,
      item_display: `${item.sku} - ${item.name}`,
      _item_search: `${item.sku} - ${item.name}`,
      _is_lot_tracked: item.track_by_lot,
      _uom_label: item.uom_details?.abbreviation || '',
      _secondary_uom_label: item.secondary_uom_details?.abbreviation || ''
    });

    // Clear lot tracking number if not lot-tracked
    if (!item.track_by_lot) {
      line.patchValue({ lot_tracking_number: '' });
    }

    this.filteredItems.set([]);
    this.activeSearchIndex.set(null);
  }

  clearItemSearch(lineIndex: number) {
    // Small delay to allow click on dropdown to register
    setTimeout(() => {
      if (this.activeSearchIndex() === lineIndex) {
        this.filteredItems.set([]);
        this.activeSearchIndex.set(null);
      }
    }, 200);
  }

  onSubmit() {
    if (this.form.invalid || this.lines.length === 0) {
      this.form.markAllAsTouched();
      if (this.lines.length === 0) {
        this.toastService.error('Validation Error', 'At least one line is required.');
      }
      return;
    }

    // Validate all lines have items selected
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines.at(i);
      if (!line.get('item')?.value) {
        this.toastService.error('Validation Error', `Line ${i + 1}: Please select an item.`);
        return;
      }
    }

    this.isSubmitting = true;

    // Prepare payload — strip UI-only fields
    const payload = {
      document_type: this.form.get('document_type')?.value,
      notes: this.form.get('notes')?.value || '',
      lines: this.lines.controls.map(lineCtrl => {
        const val = lineCtrl.value;
        return {
          item: val.item,
          movement_type: val.movement_type,
          quantity: val.quantity,
          secondary_quantity: val.secondary_quantity || null,
          lot_tracking_number: val.lot_tracking_number || '',
          notes: val.notes || ''
        };
      })
    };

    this.inventoryService.createDocument(payload).subscribe({
      next: (res: any) => {
        this.toastService.success('Document Created', `Document ${res.document_number} created successfully with ${payload.lines.length} line(s).`);
        this.isSubmitting = false;
        this.resetForm();
        this.documentSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        const msg = err.error?.lines?.[0] || err.error?.detail || 'Failed to create document.';
        this.toastService.error('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
        this.isSubmitting = false;
      }
    });
  }

  resetForm() {
    this.form.reset({ document_type: 'ADJ', notes: '' });
    this.lines.clear();
  }
}
