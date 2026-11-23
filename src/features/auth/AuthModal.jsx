import styles from './AuthModal.module.css';
import AuthFlow from './AuthFlow';

/**
 * Sign-in surface: AuthFlow.jsx (email-first Welcome → Password → Create
 * account) over a scrim. Lazy-loaded per the bundle-size policy
 * (CLAUDE.md). The signed-in profile is its own page, ProfilePage.jsx.
 */
export default function AuthModal({ onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, verifyRecoveryCode, setNewPassword, signOut, friendlyError, message }) {
  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className={styles.overlay} onClick={closeOnBackdrop}>
      <AuthFlow
        onClose={onClose}
        signInWithGoogle={signInWithGoogle}
        signInWithEmail={signInWithEmail}
        signUpWithEmail={signUpWithEmail}
        checkEmailStatus={checkEmailStatus}
        resetPassword={resetPassword}
        verifyRecoveryCode={verifyRecoveryCode}
        setNewPassword={setNewPassword}
        signOut={signOut}
        friendlyError={friendlyError}
        message={message}
      />
    </div>
  );
}
