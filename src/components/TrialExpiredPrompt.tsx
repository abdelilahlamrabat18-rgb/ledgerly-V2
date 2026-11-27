import React from 'react';
import { NavLink } from 'react-router-dom';
import { Download, Shield, CreditCard, ArrowRight, Check } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

interface TrialExpiredPromptProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export function TrialExpiredPrompt({ onDismiss, compact = false }: TrialExpiredPromptProps) {
  const { language } = usePreferences();
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const t = (en: string, fr: string, ar: string): string => {
    switch (language) {
      case 'fr': return fr;
      case 'ar': return ar;
      default: return en;
    }
  };

  const title = t(
    'Your free trial has ended',
    'Votre essai gratuit est terminé',
    'انتهت تجربتك المجانية'
  );
  const subtitle = t(
    'Choose a plan to continue using Ledgerly. Your data is safe and exportable anytime.',
    'Choisissez un plan pour continuer à utiliser Ledgerly. Vos données sont sécurisées et exportables à tout moment.',
    'اختر خطة للمتابعة مع Ledgerly. بياناتك آمنة وقابلة للتصدير في أي وقت.'
  );
  const monthlyLabel = t('Monthly', 'Mensuel', 'شهري');
  const yearlyLabel = t('Yearly', 'Annuel', 'سنوي');
  const foundingLabel = t('Founding', 'Fondateur', 'مؤسس');
  const perMonth = t('/month', '/mois', '/شهر');
  const perYear = t('/year', '/an', '/سنة');
  const oneTime = t('one-time', 'paiement unique', 'دفعة واحدة');
  const mostPopular = t('Most popular', 'Le plus populaire', 'الأكثر شيوعاً');
  const selectPlan = t('Select plan', 'Choisir ce plan', 'اختر الخطة');
  const exportData = t('Export my data', 'Exporter mes données', 'تصدير بياناتي');
  const refundPolicy = t('Refund policy', 'Politique de remboursement', 'سياسة الاسترداد');
  const fourteenDayRefund = t(
    '14-day refund on first payment',
    'Remboursement sous 14 jours sur le premier paiement',
    'استرداد خلال 14 يوماً على الدفعة الأولى'
  );
  const cancelAnytime = t('Cancel anytime', 'Annulable à tout moment', 'إلغاء في أي وقت');
  const lifetimeAccess = t('Lifetime access, no recurring charges', 'Accès à vie, pas de frais récurrents', 'وصول مدى الحياة، لا رسوم متكررة');
  const save17 = t('Save 17%', 'Économisez 17%', 'وفر 17%');

  if (compact) {
    return (
      <div className="trial-expired-compact" style={{
        direction: dir,
        padding: '16px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c53030' }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <strong style={{ fontSize: 14 }}>{title}</strong>
            </div>
          </div>
          <NavLink
            to="/app/billing"
            className="button button-primary"
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {t('Upgrade now', 'Mettre à niveau', 'ترقية الآن')} <ArrowRight size={14} />
          </NavLink>
          <button
            onClick={onDismiss}
            aria-label={t('Dismiss', 'Ignorer', 'تجاهل')}
            style={{ background: 'none', border: 'none', color: '#9aa4b2', cursor: 'pointer', padding: 4 }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: dir }} className="trial-expired-modal">
      <div className="modal-backdrop" onClick={onDismiss}>
        <div className="modal" role="dialog" style={{ maxWidth: 520, margin: '40px auto' }}>
          <div className="modal-header" style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a202c' }}>{title}</h2>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#718096', lineHeight: 1.5 }}>{subtitle}</p>
            </div>
            <button
              onClick={onDismiss}
              aria-label={t('Close', 'Fermer', 'إغلاق')}
              style={{ background: 'none', border: 'none', fontSize: 24, color: '#a0aec0', cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>

          <div className="modal-body" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
              {/* Monthly Plan */}
              <article style={{
                padding: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1a202c' }}>$24</span>
                  <span style={{ color: '#718096', fontSize: 13 }}>{perMonth}</span>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#1a202c' }}>{monthlyLabel}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {cancelAnytime}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {fourteenDayRefund}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {exportData}</li>
                </ul>
                <button
                  style={{
                    marginTop: 'auto',
                    padding: '10px 16px',
                    background: '#f59b64',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {selectPlan}
                </button>
              </article>

              {/* Yearly Plan - Most Popular */}
              <article style={{
                padding: '20px',
                border: '2px solid #f59b64',
                borderRadius: 12,
                background: '#fffaf5',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#f59b64', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{mostPopular}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1a202c' }}>$240</span>
                  <span style={{ color: '#718096', fontSize: 13 }}>{perYear}</span>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#1a202c' }}>{yearlyLabel}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {save17}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {cancelAnytime}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {fourteenDayRefund}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {exportData}</li>
                </ul>
                <button
                  style={{
                    marginTop: 'auto',
                    padding: '10px 16px',
                    background: '#f59b64',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {selectPlan}
                </button>
              </article>

              {/* Founding Plan */}
              <article style={{
                padding: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1a202c' }}>$149</span>
                  <span style={{ color: '#718096', fontSize: 13 }}>{oneTime}</span>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#1a202c' }}>{foundingLabel}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {lifetimeAccess}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {fourteenDayRefund}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}><Check size={14} style={{ color: '#2db47a', flexShrink: 0 }} /> {exportData}</li>
                </ul>
                <button
                  style={{
                    marginTop: 'auto',
                    padding: '10px 16px',
                    background: '#718096',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {selectPlan}
                </button>
              </article>
            </div>

            <div style={{
              padding: '16px',
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: '#eef7f1', color: '#2db47a' }}><Download size={18} /></div>
                <div>
                  <strong style={{ fontSize: 13, color: '#1a202c', display: 'block' }}>{exportData}</strong>
                  <span style={{ fontSize: 11, color: '#718096' }}>{t('Download CSV of all your data', 'Téléchargez le CSV de toutes vos données', 'تنزيل CSV لجميع بياناتك')}</span>
                </div>
              </div>
              <NavLink
                to="/refund-policy"
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#f59b64',
                  border: '1px solid #f59b64',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {refundPolicy}
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrialExpiredPrompt;