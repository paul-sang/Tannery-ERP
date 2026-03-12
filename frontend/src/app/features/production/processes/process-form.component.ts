import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ProductionService, ProductionStage } from '../../../core/api/production.service';
import { InventoryService, Item } from '../../../core/api/inventory.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-process-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './process-form.component.html'
})
export class ProcessFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productionService = inject(ProductionService);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() processSaved = new EventEmitter<any>();

  form: FormGroup;
  stages: ProductionStage[] = [];
  items: Item[] = [];
  isSubmitting = false;

  constructor() {
    this.form = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      stage: [null, Validators.required],
      target_item: [null],
      approximate_duration_hours: [0, [Validators.required, Validators.min(0)]],
      is_active: [true]
    });
  }

  ngOnInit() {
    this.productionService.getStages().subscribe((res: ProductionStage[]) => this.stages = res);
    this.inventoryService.getItems(1, 100).subscribe((res) => {
      this.items = res.results;
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.productionService.createProcess(this.form.value).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', 'Production Recipe created successfully.');
        this.isSubmitting = false;
        this.form.reset({
          approximate_duration_hours: 0,
          is_active: true
        });
        this.processSaved.emit(res);
        this.closeForm.emit();
      },
      error: (err: any) => {
        this.toastService.error('Error', 'Failed to save recipe. Ensure code is unique.');
        this.isSubmitting = false;
      }
    });
  }
}
