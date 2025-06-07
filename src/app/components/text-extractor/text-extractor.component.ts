import { Component, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, take } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

interface TextExtractionResult {
  text: string;
  bounding_box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

@Component({
  selector: 'app-text-extractor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './text-extractor.component.html',
  styleUrls: ['./text-extractor.component.scss']
})
export class TextExtractorComponent {
  private readonly validFileSize = 2000000;
  private readonly allowedExtensions = ['jpg', 'jpeg', 'png'];

  public fileName: WritableSignal<string | null> = signal('');
  public extractedText: WritableSignal<string> = signal('');
  public errorMessage: WritableSignal<string | null> = signal('');
  public isLoading: WritableSignal<boolean> = signal(false);;
  public imagePreview: WritableSignal<string | null> = signal(null);
  public isCopied: WritableSignal<boolean> = signal(false);

  constructor(private http: HttpClient) { }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      this.errorMessage.set('Please select a file to upload.');
      return;
    }

    const file: File = input.files[0];
    if (!this.validateFile(file)) {
      return;
    }

    this.fileName.set(file.name);
    this.generatePreview(file);
    this.uploadFile(file);
  }

  public copyText(): void {
    if (this.extractedText()) {
      navigator.clipboard.writeText(this.extractedText()).then(() => {
        this.isCopied.set(true);

        setTimeout(() => {
          this.isCopied.set(false);
        }, 2000);
      })
        .catch(() => {
          this.errorMessage.set('Failed to copy text.');
        });
    }
  }

  private validateFile(file: File): boolean {
    if (file.size > this.validFileSize) {
      this.errorMessage.set('The file size must not exceed 2MB.');
      return false;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !this.allowedExtensions.includes(fileExtension)) {
      this.errorMessage.set('Only JPEG and PNG files are allowed.');
      return false;
    }

    this.errorMessage.set(null);
    return true;
  }

  private generatePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  private uploadFile(file: File): void {
    this.isLoading.set(true);
    const formData = new FormData();
    formData.append('image', file);

    const headers = new HttpHeaders({
      'X-Api-Key': environment.apiKey
    });

    this.http
      .post<TextExtractionResult[]>('https://api.api-ninjas.com/v1/imagetotext', formData, { headers })
      .pipe(take(1), finalize(() => {
        this.isLoading.set(false);
      }
      ))
      .subscribe({
        next: (body) => {
          this.extractedText.set(this.formatText(body));
          this.errorMessage.set(null);
        },
        error: (error) => {
          this.errorMessage.set(error.error?.message || 'Upload failed');
        }
      });
  }

  private formatText(results: TextExtractionResult[]): string {
    if (!results.length) return '';

    const avgHeight =
      results.reduce((sum, item) => sum + (item.bounding_box.y2 - item.bounding_box.y1), 0) /
      results.length;
    const lineThreshold = avgHeight * 1.5;

    const sortedResults = [...results].sort(
      (a, b) => a.bounding_box.y1 - b.bounding_box.y1
    );

    const lines: TextExtractionResult[][] = [];
    let currentLine: TextExtractionResult[] = [sortedResults[0]];

    for (let i = 1; i < sortedResults.length; i++) {
      const prev = sortedResults[i - 1];
      const curr = sortedResults[i];

      const verticalDistance = curr.bounding_box.y1 - prev.bounding_box.y1;

      if (verticalDistance <= lineThreshold) {
        currentLine.push(curr);
      } else {
        lines.push(currentLine);
        currentLine = [curr];
      }
    }
    lines.push(currentLine);

    return lines
      .map((line) =>
        line
          .sort((a, b) => a.bounding_box.x1 - b.bounding_box.x1)
          .map((item) => item.text.trim())
          .join(' ')
      )
      .join('\n');
  }
}