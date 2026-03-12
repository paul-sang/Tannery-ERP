import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html'
})
export class ModalComponent {
  @Input() title: string = 'Modal Title';
  @Input() isOpen: boolean = false;
  @Input() maxWidthClass: string = 'max-w-2xl'; // Allow custom width (e.g. max-w-lg, max-w-4xl)

  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  // Prevent clicks inside the modal content from closing the modal
  onContentClick(event: MouseEvent) {
    event.stopPropagation();
  }
}
