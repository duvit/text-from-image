import { Component } from '@angular/core';
import { TextExtractorComponent } from './components/text-extractor/text-extractor.component';

@Component({
  selector: 'app-root',
  imports: [TextExtractorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'text-from-image';
}
