export interface I18nLoaderOptions {
  entrypoint?: string
  cacheAll?: boolean | string[]
  cacheVersion?: number
  language?: string
  useCache?: boolean
}

export interface I18nLoaderModule {
  loadMessages: (name: string, options: I18nLoaderOptions) => JQueryDeferred<(I18nLoader & { msg: undefined })>
}

export interface I18nLoader<T> {
  msg: (key: T, ...params: string[]) => mw.Message
  getMessages: () => mw.Map
  useLang: () => void
  inLang: (lang: string) => this
  useContentLang: () => void
  inContentLang: () => this
  usePageLang: () => void
  inPageLang: () => this
  usePageViewLang: () => void
  inPageViewLang: () => this
  useUserLang: () => void
  inUserLang: () => this
}

export interface I18nLoaderWithEncapsulatedMethods extends I18nLoader {
  _defaultLang: string
  _tempLang: string | null
  _msgMaps: Record<string, mw.Map>
  _rawMessageJson: Record<string, Record<string, string>>
  _setDefaultLang: (lang: string) => void
  _setTempLang: (lang: string) => void
}