import type { Settings as DimApiSettings } from '@destinyitemmanager/dim-api-types';
import { defaultSettings } from '@destinyitemmanager/dim-api-types';
import type { DimLanguage } from 'app/i18n';
import { defaultLanguage } from 'app/i18n';

/**
 * We extend the settings interface so we can try out new settings before committing them to dim-api-types
 */
export interface Settings extends DimApiSettings {
  language: DimLanguage;
}

export const initialSettingsState: Settings = {
  ...defaultSettings,
  language: defaultLanguage(),
};
