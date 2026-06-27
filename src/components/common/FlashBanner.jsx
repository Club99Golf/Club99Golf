export default function FlashBanner({ message, type = "success", onClose }) {
  if (!message) return null;
  return (
    <div className={`flash-banner flash-banner--${type}`} onClick={onClose}>
      {message}
    </div>
  );
}
