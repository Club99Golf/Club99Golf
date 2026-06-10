import "../../styles/bottom-nav.css";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "rankings", label: "Rankings" },
  { id: "challenges", label: "Challenges" },
  { id: "live", label: "Live" },
  { id: "shop", label: "Shop" },
];

export default function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav__item ${activeTab === tab.id ? "bottom-nav__item--active" : ""}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
