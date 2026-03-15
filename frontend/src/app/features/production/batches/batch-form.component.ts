import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ProductionService, ProductionProcess } from '../../../core/api/production.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-batch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './batch-form.component.html'
})
export class BatchFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);

  @Input() isOpen = false;
  @Output() closeForm = new EventEmitter<void>();
  @Output() batchSaved = new EventEmitter<any>();

  form: FormGroup;
  processes: ProductionProcess[] = [];
  isSubmitting = false;

  constructor() {
    this.form = this.fb.group({
      process: [null, Validators.required],
      notes: ['']
    });
  }

  ngOnInit() {
    this.productionService.getProcesses(1, 100).subscribe((res) => {
      this.processes = res.results.filter((p: ProductionProcess) => p.is_active);
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    this.productionService.createBatch(this.form.value).subscribe({
      next: (res: any) => {
        this.toastService.success('Success', `Batch ${res.batch_number} created successfully.`);
        this.isSubmitting = false;
        this.form.reset();
        this.batchSaved.emit(res);
        this.closeForm.emit();
      },
      error: () => {
        this.toastService.error('Error', 'Failed to create batch.');
        this.isSubmitting = false;
      }
    });
  }
}
