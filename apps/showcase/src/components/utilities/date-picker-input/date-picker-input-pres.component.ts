import { ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges, Optional, signal, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CloseInputDatePickerDirective, DfInputIconDirective } from '@design-factory/design-factory';
import { NgbDate, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { O3rComponent } from '@o3r/core';
import { DatePickerInputPresContext } from './date-picker-input-pres.context';
import { ConfigObserver } from '@o3r/configuration';
import { ConfigurationBaseService } from '@o3r/configuration';
import { ConfigurationObserver } from '@o3r/configuration';
import { DynamicConfigurable } from '@o3r/configuration';
import { DATE_PICKER_INPUT_PRES_DEFAULT_CONFIG } from './date-picker-input-pres.config';
import { DATE_PICKER_INPUT_PRES_CONFIG_ID } from './date-picker-input-pres.config';
import { DatePickerInputPresConfig } from './date-picker-input-pres.config';
import { Observable } from 'rxjs';
@O3rComponent({ componentType: 'ExposedComponent' })
@Component({
  selector: 'o3r-date-picker-input-pres',
  standalone: true,
  imports: [FormsModule, CloseInputDatePickerDirective, NgbInputDatepicker, DfInputIconDirective],
  templateUrl: './date-picker-input-pres.template.html',
  styleUrls: ['./date-picker-input-pres.style.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerInputPresComponent),
      multi: true
    }
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatePickerInputPresComponent implements ControlValueAccessor, DatePickerInputPresContext, OnChanges, DynamicConfigurable<DatePickerInputPresConfig> {

  /** Configuration stream based on the input and the stored configuration*/
  public config$: Observable<DatePickerInputPresConfig>;
  @ConfigObserver()

  private readonly dynamicConfig$: ConfigurationObserver<DatePickerInputPresConfig>;

  /** Input configuration to override the default configuration of the component*/
  @Input()
  public config: Partial<DatePickerInputPresConfig> | undefined;

  private onTouched!: () => void;

  private onChanges!: (val: string) => void;

  /** Disabled state of the date-picker */
  public isDisabled = signal(false);

  /** Internal selected date by NgBootstrap */
  public selectedDate = signal<NgbDate | null>(null);

  /** ID of the html element used for selection */
  @Input()
  public id!: string;

  constructor(
    @Optional() configurationService: ConfigurationBaseService) {
    this.dynamicConfig$ = new ConfigurationObserver<DatePickerInputPresConfig>(DATE_PICKER_INPUT_PRES_CONFIG_ID, DATE_PICKER_INPUT_PRES_DEFAULT_CONFIG, configurationService);
    this.config$ = this.dynamicConfig$.asObservable();
  }

  /**
   * Trigger when a date is selected
   * @param date
   */
  public selectDate(date: NgbDate | null) {
    this.selectedDate.set(date);
    this.onChanges(date ? `${date.year}-${date.month}-${date.day}` : '');
    this.onTouched();
  }
  /**
   * Implements ControlValueAccessor
   * @param fn
   */
  public registerOnChange(fn: any): void {
    this.onChanges = fn;
  }
  /**
   * Implements ControlValueAccessor
   * @param fn
   */
  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  /**
   * Implements ControlValueAccessor
   * @param isDisabled
   */
  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
  /**
   * Implements ControlValueAccessor
   * @param obj
   */
  public writeValue(obj: any): void {
    if (typeof obj === 'string' && /\d{4}-\d{2}-\d{2}/.test(obj)) {
      const [year, month, day] = obj.split('-', 3);
      this.selectedDate.set(NgbDate.from({ year: +year, month: +month, day: +day }));
    }
    else {
      this.selectedDate.set(null);
    }
  }
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.config) {
      this.dynamicConfig$.next(this.config);
    }
  }
}
