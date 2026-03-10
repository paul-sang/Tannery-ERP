import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { TranslationService } from '../../core/translation.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './login.component.html'
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private http = inject(HttpClient);
    public translationService = inject(TranslationService);

    loginForm = this.fb.group({
        username: ['', Validators.required],
        password: ['', Validators.required]
    });

    onSubmit() {
        if (this.loginForm.valid) {
            this.http.post(`${environment.apiUrl}/token/`, this.loginForm.value)
                .subscribe({
                    next: (response) => console.log('Login successful', response),
                    error: (err) => console.error('Login failed', err)
                });
        }
    }

    toggleLanguage() {
        const nextLang = this.translationService.currentLang === 'en' ? 'es' : 'en';
        this.translationService.setLanguage(nextLang);
    }
}
