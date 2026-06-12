export default function OnboardingLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 32,
        backgroundColor: '#fdfaf5',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '2.5px solid rgba(212, 130, 10, 0.18)',
          borderTopColor: '#d4820a',
          borderRadius: '50%',
          animation: 'tafel-spin 0.9s linear infinite',
        }}
      />
      <style>{`
        @keyframes tafel-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
