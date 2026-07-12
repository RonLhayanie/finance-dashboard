const ERROR_MESSAGES = {
  invalid_credentials: 'פרטי התחברות שגויים. בדקו את שם המשתמש והסיסמה ונסו שוב.',
  account_blocked: 'החשבון נחסם על ידי הבנק או חברת האשראי. יש ליצור קשר עם הגורם הפיננסי.',
  change_password_required: 'נדרש לשנות סיסמה באתר הבנק או חברת האשראי לפני שאפשר לסנכרן.',
  timeout: 'הסנכרון ארך זמן רב מדי ובוטל. נסו שוב מאוחר יותר.',
  otp_timeout: 'קוד האימות לא הוזן בזמן. יש להתחיל סנכרון חדש ולהזין את הקוד כשהוא מתקבל.',
  two_factor_unsupported: 'אימות דו-שלבי אינו נתמך עבור ספק זה.',
  unsupported_provider: 'הספק שנבחר אינו נתמך.',
  manually_reset: 'הסנכרון הקודם אופס ידנית. אפשר לנסות לסנכרן שוב.',
  unknown: 'הסנכרון נכשל מסיבה לא ידועה. נסו שוב מאוחר יותר.',
};

export function getSyncErrorMessage(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown;
}
