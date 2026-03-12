import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InventoryService, UOM } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './item-form.component.html'
})
export class ItemFormComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Input() itemToEdit: any | null = null;
  @Output() closeForm = new EventEmitter<void>();
  @Output() itemSaved = new EventEmitter<any>();

  form: FormGroup;
  categories: any[] = [];
  uoms: UOM[] = [];
  isSubmitting = false;

  constructor() {
    this.form = this.fb.group({
      sku: ['', Validators.required],
      name: ['', Validators.required],
      category: [null, Validators.required],
      uom: [null, Validators.required],
      secondary_uom: [null],
      min_stock_level: [0, [Validators.required, Validators.min(0)]],
      status: ['ACTIVE', Validators.required],
      track_by_lot: [true],
      attributes: this.fb.group({})
    });
  }

  ngOnInit() {
    this.inventoryService.getCategories(1, 100).subscribe((res) => {
      this.categories = res.results;
    });
    this.inventoryService.getUoms(1, 100).subscribe((res) => {
      this.uoms = res.results;
    });

    this.form.get('category')?.valueChanges.subscribe(categoryId => {
      if (categoryId) {
        this.inventoryService.getNextSku(categoryId).subscribe(res => {
          this.form.patchValue({ sku: res.next_sku });
        });

        const cat = this.categories.find(c => c.id === categoryId);
        if (cat) {
          this.updateAttributeFields(cat.name);
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['itemToEdit'] && this.itemToEdit) {
      if (this.itemToEdit.category) {
        // Need to set category first so the form knows which attributes to show
        const cat = this.categories.find(c => c.id === this.itemToEdit.category || c.id === this.itemToEdit.category_details?.id);
        if (cat) {
          this.updateAttributeFields(cat.name);
        }
      }

      this.form.patchValue({
        sku: this.itemToEdit.sku,
        name: this.itemToEdit.name,
        category: this.itemToEdit.category,
        uom: this.itemToEdit.uom,
        secondary_uom: this.itemToEdit.secondary_uom,
        min_stock_level: this.itemToEdit.min_stock_level,
        status: this.itemToEdit.status,
        track_by_lot: this.itemToEdit.track_by_lot ?? true,
        attributes: this.itemToEdit.attributes || {}
      });
    } else if (changes['itemToEdit'] && !this.itemToEdit) {
      this.form.reset({ min_stock_level: 0, status: 'ACTIVE', track_by_lot: true });
    }
  }

  get selectedCategoryName(): string | null {
    const catId = this.form.get('category')?.value;
    if (!catId) return null;
    const cat = this.categories.find(c => c.id === catId);
    return cat ? cat.name : null;
  }

  updateAttributeFields(categoryName: string) {
    const attrGroup = this.form.get('attributes') as FormGroup;
    
    // Clear existing controls securely without replacing the whole group object
    Object.keys(attrGroup.controls).forEach(key => attrGroup.removeControl(key));

    if (categoryName === 'FINISHED_LEATHER') {
      attrGroup.addControl('finish_type', this.fb.control('', Validators.required));
      attrGroup.addControl('thickness', this.fb.control('', Validators.required));
      attrGroup.addControl('color', this.fb.control('', Validators.required));
    } else if (categoryName === 'CHEMICAL') {
      attrGroup.addControl('hazard_level', this.fb.control('Normal'));
      attrGroup.addControl('ph_level', this.fb.control(''));
      attrGroup.addControl('state', this.fb.control('Liquid'));
    } else if (categoryName === 'RAW_HIDE') {
      attrGroup.addControl('origin', this.fb.control('Local'));
      attrGroup.addControl('average_weight', this.fb.control(''));
      attrGroup.addControl('preservation_method', this.fb.control('Wet Salted'));
    }
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    if (this.itemToEdit) {
      this.inventoryService.updateItem(this.itemToEdit.id, this.form.value).subscribe({
        next: (res: any) => {
          this.toastService.success('Success', 'Item updated successfully.');
          this.isSubmitting = false;
          this.itemSaved.emit(res);
          this.closeForm.emit();
        },
        error: (err: any) => {
          this.toastService.error('Error', 'Failed to update item.');
          this.isSubmitting = false;
        }
      });
    } else {
      this.inventoryService.createItem(this.form.value).subscribe({
        next: (res: any) => {
          this.toastService.success('Success', 'Item created successfully.');
          this.isSubmitting = false;
          this.form.reset({ min_stock_level: 0, status: 'ACTIVE', track_by_lot: true });
          this.itemSaved.emit(res);
          this.closeForm.emit();
        },
        error: (err: any) => {
          this.toastService.error('Error', 'Failed to save item. Check SKU uniqueness.');
          this.isSubmitting = false;
        }
      });
    }
  }
}
