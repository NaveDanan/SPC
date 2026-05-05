import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'he';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation strings
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    'header.title': 'SPC Analysis',
    'header.subtitle': 'Statistical Process Control by NJ-Labs',
    'header.help': 'Help',
    'header.helpMessage': 'SPC Analysis tool for statistical process control. Upload data to generate control charts and analyze process stability.',
    
    // Common
    'common.upload': 'Upload',
    'common.reset': 'Reset',
    'common.download': 'Download',
    'common.print': 'Print',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    
    // File Upload
    'upload.title': 'Upload Data',
    'upload.dragDrop': 'Drag and drop your data file here',
    'upload.or': 'or',
    'upload.browse': 'Browse Files',
    'upload.supported': 'Supported formats: CSV, Excel (XLSX, XLS, XLSM)',
    
    // Charts
    'chart.individual': 'Individual',
    'chart.xBarR': 'X-bar R',
    'chart.xBarS': 'X-bar S',
    'chart.pChart': 'P Chart',
    'chart.npChart': 'NP Chart',
    'chart.ewma': 'EWMA',
    'chart.histogram': 'Histogram',
    'chart.scatter': 'Scatter Plot',
    
    // Control Panel
    'control.title': 'Control Panel',
    'control.chartType': 'Chart Type',
    'control.selectColumn': 'Select Column',
    'control.sampleSize': 'Sample Size',
    'control.options': 'Chart Options',
    
    // Footer
    'footer.copyright': '© 2025 NJ-Labs. All rights reserved.',
    
    // AI Assistant
    'ai.title': 'AI Chart Assistant',
    'ai.subtitle': 'Discuss your process and receive SPC chart suggestions.',
    'ai.close': 'Close AI assistant',
    'ai.thinking': 'The assistant is thinking…',
    'ai.placeholder': 'Ask how to monitor your process or provide more context…',
    'ai.send': 'Send',
    'ai.sending': 'Sending…',
    'ai.regenerate': 'Regenerate response',
    'ai.copy': 'Copy response',
    'ai.download': 'Download response',
    'ai.edit': 'Edit question',
    'ai.editLabel': 'Edit question',
    'ai.saveChanges': 'Save changes',
    'ai.notConfigured': 'AI assistant is not configured. Set AI API URL, API key, and model through runtime config (/config/runtime-config.js) or VITE_AI_* environment variables.',
    'ai.configError': 'I could not reach the AI service because it is not configured. Ask your administrator to set AI runtime config or VITE_AI_* environment variables.',
    'ai.welcomeMessage': 'Upload a CSV or Excel file and I will recommend the most appropriate SPC control chart. You can also ask follow-up questions here.',
    'ai.datasetCleared': 'It looks like the dataset was cleared. Upload a new file when you are ready and I will refresh my recommendation.',
    'ai.serviceError': 'I ran into a problem contacting the AI service: ',
    'ai.uploadedDataset': 'Uploaded dataset',
    'ai.agentHint': 'Agent Mode auto-applies valid chart setup changes from structured AI recommendations.',
    'ai.agentModeOn': 'Agent Mode: ON',
    'ai.agentModeOff': 'Agent Mode: OFF',
    'ai.agentProposalTitle': 'Agent recommendation ready',
    'ai.agentProposedChart': 'Chart type',
    'ai.agentProposedY': 'Y column',
    'ai.agentProposedX': 'X-axis column',
    'ai.agentProposedSample': 'Sample size',
    'ai.agentReason': 'Reason',
    'ai.agentNoChange': 'No change',
    'ai.agentApprove': 'Approve and apply',
    'ai.agentDismiss': 'Dismiss',
    'ai.agentApplied': 'Agent recommendation applied to chart settings.',
    'ai.agentDismissed': 'Agent recommendation dismissed.',
    'ai.agentNoChangeDetected': 'Agent recommendation did not include valid UI changes.',
    'ai.selectWorksheetPrompt': 'This workbook has multiple worksheets. Choose one sheet below before I analyze with AI.',
    'ai.worksheetSelectedPrefix': 'Worksheet selected',
    
    // File Upload Panel
    'fileUpload.title': 'Data Input',
    'fileUpload.askAI': 'Ask AI',
    'fileUpload.dragDrop': 'Drag & drop a file here, or click to select',
    'fileUpload.supports': 'Supports CSV, XLS, XLSX, XLSM',
    'fileUpload.uploading': 'Uploading and parsing file...',
    'fileUpload.rows': 'rows',
    'fileUpload.columns': 'columns',
    'fileUpload.selectXAxis': 'Select X-Axis Column (optional)',
    'fileUpload.useRowIndex': '— Use row index —',
    'fileUpload.xAxisHint': 'If set, charts use this column for X values (e.g., Date).',
    'fileUpload.selectYValue': 'Select Y-Value Column (used for SPC)',
    'fileUpload.sampleSize': 'Sample Size (for X-bar charts)',
    'fileUpload.sampleSizeHint': 'For X-bar charts (S or R), data will be grouped into subgroups of this size',
    'fileUpload.noData': "Don't have data? Use example dataset",
    
    // Control Panel
    'controlPanel.title': 'Chart Controls',
    'controlPanel.chartType': 'Chart Type',
    'controlPanel.chartTitle': 'Chart Title',
    'controlPanel.xAxisLabel': 'X-Axis Label',
    'controlPanel.yAxisLabel': 'Y-Axis Label',
    'controlPanel.lowerSpecLimit': 'Lower Spec Limit (LSL)',
    'controlPanel.upperSpecLimit': 'Upper Spec Limit (USL)',
    'controlPanel.displayOptions': 'Display Options',
    'controlPanel.showControlLimits': 'Show Control Limits',
    'controlPanel.showCenterLine': 'Show Center Line',
    'controlPanel.showSigma1': 'Show ±1σ',
    'controlPanel.showSigma2': 'Show ±2σ',
    'controlPanel.showSigma3': 'Show ±3σ',
    'controlPanel.highlightViolations': 'Highlight Rule Violations',
    
    // Chart Panel
    'chartPanel.processing': 'Processing data...',
    'chartPanel.selectData': 'Select data and chart type to generate a chart',
    'chartPanel.mean': 'Mean (CL)',
    'chartPanel.ucl': 'Upper Control Limit',
    'chartPanel.lcl': 'Lower Control Limit',
    'chartPanel.stdDev': 'Standard Deviation',
    'chartPanel.cp': 'Cp',
    'chartPanel.cpl': 'Cpl',
    'chartPanel.cpu': 'Cpu',
    'chartPanel.cpk': 'Cpk',
    
    // Data Preview
    'dataPreview.title': 'Data Preview',
    'dataPreview.copy': 'Copy',
    'dataPreview.paste': 'Paste',
    'dataPreview.export': 'Export Selection to CSV',
    'dataPreview.selected': 'Selected:',
    'dataPreview.unsaved': 'Unsaved changes',
    'dataPreview.apply': 'Apply',
    'dataPreview.removeFirstRow': 'Remove First Row',
    'dataPreview.useFirstRowAsHeaders': 'Use First Row as Headers',
    'dataPreview.noData': 'No data available. Please upload a file.',
    
    // Rule Violations Panel
    'ruleViolations.title': 'Process Analysis',
    'ruleViolations.uploadData': 'Upload and process data to view analysis',
    'ruleViolations.inControl': 'Process is in control',
    'ruleViolations.outOfControl': 'Process is out of control',
    'ruleViolations.noViolations': 'No rule violations detected. The process appears to be stable and in control.',
    'ruleViolations.violationsDetected': 'rule violations detected across',
    'ruleViolations.ruleTypes': 'rule types.',
    'ruleViolations.summary': 'Rule Violations Summary',
    'ruleViolations.rule': 'Rule',
    'ruleViolations.violation': 'violation',
    'ruleViolations.violations': 'violations',
    'ruleViolations.controlLimits': 'Control Limits',
    'ruleViolations.centerLine': 'Center Line:',
    'ruleViolations.processSigma': 'Process Sigma:',
    'ruleViolations.ucl': 'Upper Control Limit:',
    'ruleViolations.lcl': 'Lower Control Limit:',
    'ruleViolations.westernRules': 'Western Electric Rules',
  },
  he: {
    // Header
    'header.title': 'ניתוח SPC',
    'header.subtitle': 'בקרת תהליכים סטטיסטית על ידי NJ-Labs',
    'header.help': 'עזרה',
    'header.helpMessage': 'כלי ניתוח SPC לבקרת תהליכים סטטיסטית. העלה נתונים ליצירת תרשימי בקרה וניתוח יציבות תהליכים.',
    
    // Common
    'common.upload': 'העלאה',
    'common.reset': 'איפוס',
    'common.download': 'הורדה',
    'common.print': 'הדפסה',
    'common.close': 'סגירה',
    'common.cancel': 'ביטול',
    'common.save': 'שמירה',
    'common.delete': 'מחיקה',
    
    // File Upload
    'upload.title': 'העלאת נתונים',
    'upload.dragDrop': 'גרור ושחרר את קובץ הנתונים כאן',
    'upload.or': 'או',
    'upload.browse': 'עיון בקבצים',
    'upload.supported': 'פורמטים נתמכים: CSV, Excel (XLSX, XLS, XLSM)',
    
    // Charts
    'chart.individual': 'אינדיבידואלי',
    'chart.xBarR': 'X-bar R',
    'chart.xBarS': 'X-bar S',
    'chart.pChart': 'תרשים P',
    'chart.npChart': 'תרשים NP',
    'chart.ewma': 'EWMA',
    'chart.histogram': 'היסטוגרמה',
    'chart.scatter': 'תרשים פיזור',
    
    // Control Panel
    'control.title': 'לוח בקרה',
    'control.chartType': 'סוג תרשים',
    'control.selectColumn': 'בחר עמודה',
    'control.sampleSize': 'גודל מדגם',
    'control.options': 'אפשרויות תרשים',
    
    // Footer
    'footer.copyright': '© 2025 NJ-Labs. כל הזכויות שמורות.',
    
    // AI Assistant
    'ai.title': 'עוזר AI לתרשימים',
    'ai.subtitle': 'דון בתהליך שלך וקבל המלצות לתרשימי SPC.',
    'ai.close': 'סגור עוזר AI',
    'ai.thinking': 'העוזר חושב…',
    'ai.placeholder': 'שאל כיצד לעקוב אחר התהליך שלך או ספק הקשר נוסף…',
    'ai.send': 'שלח',
    'ai.sending': 'שולח…',
    'ai.regenerate': 'יצירת תשובה מחדש',
    'ai.copy': 'העתק תשובה',
    'ai.download': 'הורד תשובה',
    'ai.edit': 'ערוך שאלה',
    'ai.editLabel': 'ערוך שאלה',
    'ai.saveChanges': 'שמור שינויים',
    'ai.notConfigured': 'עוזר ה-AI אינו מוגדר. יש להגדיר כתובת API, מפתח API ומודל דרך /config/runtime-config.js או דרך משתני הסביבה VITE_AI_*.',
    'ai.configError': 'לא הצלחתי להגיע לשירות ה-AI כי הוא לא מוגדר. בקש ממנהל המערכת להגדיר תצורת AI בזמן ריצה או משתני סביבה VITE_AI_*.',
    'ai.welcomeMessage': 'העלה קובץ CSV או Excel ואני אמליץ על תרשים הבקרה SPC המתאים ביותר. אתה יכול גם לשאול שאלות המשך כאן.',
    'ai.datasetCleared': 'נראה שמערך הנתונים נוקה. העלה קובץ חדש כשתהיה מוכן ואני אעדכן את ההמלצה שלי.',
    'ai.serviceError': 'נתקלתי בבעיה בהתקשרות לשירות ה-AI: ',
    'ai.uploadedDataset': 'מערך נתונים שהועלה',
    'ai.agentHint': 'מצב Agent מחיל אוטומטית שינויי הגדרות תקינים מתשובות מובנות של ה-AI.',
    'ai.agentModeOn': 'מצב Agent: פעיל',
    'ai.agentModeOff': 'מצב Agent: כבוי',
    'ai.agentProposalTitle': 'המלצת Agent מוכנה',
    'ai.agentProposedChart': 'סוג תרשים',
    'ai.agentProposedY': 'עמודת Y',
    'ai.agentProposedX': 'עמודת ציר X',
    'ai.agentProposedSample': 'גודל מדגם',
    'ai.agentReason': 'נימוק',
    'ai.agentNoChange': 'ללא שינוי',
    'ai.agentApprove': 'אשר והחל',
    'ai.agentDismiss': 'דחה',
    'ai.agentApplied': 'המלצת Agent הוחלה על הגדרות התרשים.',
    'ai.agentDismissed': 'המלצת Agent נדחתה.',
    'ai.agentNoChangeDetected': 'המלצת Agent לא כללה שינויי ממשק תקינים.',
    'ai.selectWorksheetPrompt': 'לקובץ יש כמה גליונות. בחר גיליון אחד למטה לפני ניתוח ה-AI.',
    'ai.worksheetSelectedPrefix': 'נבחר גיליון',
    
    // File Upload Panel
    'fileUpload.title': 'קלט נתונים',
    'fileUpload.askAI': 'שאל AI',
    'fileUpload.dragDrop': 'גרור ושחרר קובץ כאן, או לחץ לבחירה',
    'fileUpload.supports': 'תומך ב-CSV, XLS, XLSX, XLSM',
    'fileUpload.uploading': 'מעלה ומנתח קובץ...',
    'fileUpload.rows': 'שורות',
    'fileUpload.columns': 'עמודות',
    'fileUpload.selectXAxis': 'בחר עמודת ציר X (אופציונלי)',
    'fileUpload.useRowIndex': '— השתמש באינדקס שורה —',
    'fileUpload.xAxisHint': 'אם מוגדר, תרשימים משתמשים בעמודה זו לערכי X (למשל, תאריך).',
    'fileUpload.selectYValue': 'בחר עמודת ערך Y (משמש ל-SPC)',
    'fileUpload.sampleSize': 'גודל מדגם (עבור תרשימי X-bar)',
    'fileUpload.sampleSizeHint': 'עבור תרשימי X-bar (S או R), הנתונים יקובצו לתת-קבוצות בגודל זה',
    'fileUpload.noData': 'אין נתונים? השתמש במערך נתונים לדוגמה',
    
    // Control Panel
    'controlPanel.title': 'בקרות תרשים',
    'controlPanel.chartType': 'סוג תרשים',
    'controlPanel.chartTitle': 'כותרת תרשים',
    'controlPanel.xAxisLabel': 'תווית ציר X',
    'controlPanel.yAxisLabel': 'תווית ציר Y',
    'controlPanel.lowerSpecLimit': 'LSL',
    'controlPanel.upperSpecLimit': 'USL',
    'controlPanel.displayOptions': 'אפשרויות תצוגה',
    'controlPanel.showControlLimits': 'הצג גבולות בקרה',
    'controlPanel.showCenterLine': 'הצג קו מרכז',
    'controlPanel.showSigma1': 'הצג ±1σ',
    'controlPanel.showSigma2': 'הצג ±2σ',
    'controlPanel.showSigma3': 'הצג ±3σ',
    'controlPanel.highlightViolations': 'הדגש הפרות כללים',
    
    // Chart Panel
    'chartPanel.processing': 'מעבד נתונים...',
    'chartPanel.selectData': 'בחר נתונים וסוג תרשים ליצירת תרשים',
    'chartPanel.mean': 'ממוצע (CL)',
    'chartPanel.ucl': 'גבול בקרה עליון',
    'chartPanel.lcl': 'גבול בקרה תחתון',
    'chartPanel.stdDev': 'סטיית תקן',
    'chartPanel.cp': 'Cp',
    'chartPanel.cpl': 'Cpl',
    'chartPanel.cpu': 'Cpu',
    'chartPanel.cpk': 'Cpk',
    
    // Data Preview
    'dataPreview.title': 'תצוגה מקדימה של נתונים',
    'dataPreview.copy': 'העתק',
    'dataPreview.paste': 'הדבק',
    'dataPreview.export': 'ייצא בחירה ל-CSV',
    'dataPreview.selected': 'נבחר:',
    'dataPreview.unsaved': 'שינויים לא שמורים',
    'dataPreview.apply': 'החל',
    'dataPreview.removeFirstRow': 'הסר שורה ראשונה',
    'dataPreview.useFirstRowAsHeaders': 'השתמש בשורה הראשונה ככותרות',
    'dataPreview.noData': 'אין נתונים זמינים. נא להעלות קובץ.',
    
    // Rule Violations Panel
    'ruleViolations.title': 'ניתוח תהליך',
    'ruleViolations.uploadData': 'העלה ועבד נתונים לצפייה בניתוח',
    'ruleViolations.inControl': 'התהליך בשליטה',
    'ruleViolations.outOfControl': 'התהליך מחוץ לשליטה',
    'ruleViolations.noViolations': 'לא זוהו הפרות כללים. התהליך נראה יציב ובשליטה.',
    'ruleViolations.violationsDetected': 'הפרות כללים זוהו על פני',
    'ruleViolations.ruleTypes': 'סוגי כללים.',
    'ruleViolations.summary': 'סיכום הפרות כללים',
    'ruleViolations.rule': 'כלל',
    'ruleViolations.violation': 'הפרה',
    'ruleViolations.violations': 'הפרות',
    'ruleViolations.controlLimits': 'גבולות בקרה',
    'ruleViolations.centerLine': 'קו מרכז:',
    'ruleViolations.processSigma': 'סיגמא תהליך:',
    'ruleViolations.ucl': 'גבול בקרה עליון:',
    'ruleViolations.lcl': 'גבול בקרה תחתון:',
    'ruleViolations.westernRules': 'כללי Western Electric',
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Load from localStorage or default to English
    const saved = localStorage.getItem('spc-language');
    return (saved === 'he' || saved === 'en') ? saved : 'en';
  });

  useEffect(() => {
    // Save to localStorage whenever language changes
    localStorage.setItem('spc-language', language);
    
    // Update document direction and language
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
