export default function ShopTab(props) {
  const { ACCENT, COINS, COIN_PACKS, DISABLE_STRIPE_PURCHASES, S, SHOP_ITEMS, Theme, attrToast, authUser, coinClientSecret, coinPaymentBusy, coinPaymentError, coinPaymentSuccess, coinShopPack, db, doc, equippedBanner, handleCoinPayment, handleCreateCourse, handleSelectCoinPack, liveAttrGains, liveRound, mountCardElement, newCourseForm, pendingShotYards, profile, profilePic, roundSubmittedRef, setCoinClientSecret, setCoinPaymentError, setCoinPaymentSuccess, setCoinShopPack, setDoc, setLiveRound, setLiveStrokesArr, setNewCourseForm, setPendingShotEndPos, setPendingShotYards, setProfile, setShopCategory, setShopConfirm, setShopPreview, setShotInFairway, setShowCreateCourse, shopCategory, shopConfirm, shopPreview, shotInFairway, showCreateCourse, tab, updateClubAverage, username } = props;
  return (
    <>
        <div className="tab-scroll" style={{ paddingBottom: 80 }}>
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 2 }}>SHOP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: Theme.mutedGold }}>🪙 {COINS.toLocaleString()} Coins</div>
            </div>

            {/* ── COIN PACKS ── hidden in iOS wrapper until Apple IAP phase */}
            <div style={{ marginBottom: 18, display: DISABLE_STRIPE_PURCHASES ? "none" : "block" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", letterSpacing: 1.5, marginBottom: 8 }}>BUY COINS</div>
              {DISABLE_STRIPE_PURCHASES && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 11px", fontSize: 11, color: "#92400e", fontWeight: 700, lineHeight: 1.4, marginBottom: 10 }}>
                  Coin purchases are disabled in the iOS wrapper. App Store purchases will be added in a later IAP phase.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {COIN_PACKS.map(pack => (
                  <button key={pack.id} disabled={DISABLE_STRIPE_PURCHASES} onClick={() => handleSelectCoinPack(pack)} style={{ position: "relative", background: DISABLE_STRIPE_PURCHASES ? "#f9fafb" : "#fff", opacity: DISABLE_STRIPE_PURCHASES ? 0.65 : 1, border: pack.tag ? `2px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 14, padding: "14px 12px", textAlign: "center", cursor: DISABLE_STRIPE_PURCHASES ? "not-allowed" : "pointer", boxShadow: pack.tag ? "0 2px 12px rgba(125,162,126,0.15)" : "none" }}>
                    {pack.tag && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: Theme.primaryGreen, color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: 1, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{pack.tag}</div>}
                    <div style={{ fontSize: 22, fontWeight: 900, color: Theme.mutedGold, fontFamily: "Bebas Neue", lineHeight: 1 }}>🪙 {pack.coins.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{pack.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 6 }}>${pack.price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {["banner","border","nameplate","boost"].map(cat => (
                <button key={cat} onClick={() => setShopCategory(cat)} style={{ padding: "7px 14px", background: shopCategory === cat ? Theme.primaryGreen : "#f9fafb", border: shopCategory === cat ? `1.5px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", borderRadius: 20, color: shopCategory === cat ? "#fff" : "#374151", fontWeight: 800, fontSize: 11, letterSpacing: 1, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 16px" }}>
            {SHOP_ITEMS.filter(item => item.type === shopCategory).map(item => {
              const owned = (profile.ownedItems || []).includes(item.id);
              const equipped = profile[`equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`] === item.id;
              const canAfford = COINS >= item.price;
              const meetsLevel = true;
              return (
                <div key={item.id} style={{ background: equipped ? "rgba(125,162,126,0.05)" : "#fff", borderRadius: 14, border: equipped ? `2px solid ${Theme.primaryGreen}` : "1px solid #e5e7eb", padding: "14px", marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
                  {/* Preview */}
                  <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: "hidden", position: "relative", ...(item.type === "banner" ? { background: item.preview } : { background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }) }} className={item.type === "banner" && item.animated === "shimmer" ? "banner-shimmer" : item.type === "banner" && item.animated === "aurora" ? "banner-aurora" : ""}>
                    {item.type === "border" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", ...item.style }} />}
                    {item.type === "nameplate" && <div style={{ fontSize: 11, fontWeight: 900, fontFamily: "Bebas Neue", ...item.style }}>ABC</div>}
                    {item.type === "boost" && <div style={{ fontSize: 22 }}>⚡</div>}
                    {item.seasonal && <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "1px 4px", fontSize: 7, fontWeight: 800, color: "#fff" }}>{item.seasonLabel}</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{item.label}</div>
                    {item.type === "boost" && <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.desc}</div>}
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>🪙 {item.price.toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                    {item.type !== "boost" && (
                      <button onClick={() => setShopPreview(item)} style={{ padding: "7px 12px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, color: "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Preview
                      </button>
                    )}
                    {owned ? (
                      item.type !== "boost" ? (
                        <button onClick={() => {
                          const key = `equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`;
                          setProfile(p => ({ ...p, [key]: p[key] === item.id ? null : item.id }));
                        }} style={{ padding: "7px 12px", background: equipped ? "rgba(125,162,126,0.1)" : "#f9fafb", border: `1px solid ${equipped ? Theme.primaryGreen : "#e5e7eb"}`, borderRadius: 8, color: equipped ? Theme.primaryGreen : "#374151", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          {equipped ? "Equipped ✓" : "Equip"}
                        </button>
                      ) : <div style={{ fontSize: 12, color: Theme.primaryGreen, fontWeight: 700 }}>Owned</div>
                    ) : (
                      <button onClick={() => setShopConfirm(item)} disabled={!canAfford || !meetsLevel} style={{ padding: "7px 12px", background: canAfford && meetsLevel ? Theme.primaryGreen : "#f3f4f6", border: "none", borderRadius: 8, color: canAfford && meetsLevel ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 12, cursor: canAfford && meetsLevel ? "pointer" : "default" }}>
                        {!meetsLevel ? `Lvl ${item.level}` : !canAfford ? "Need 🪙" : `Buy`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Shop preview modal */}
          {shopPreview && (() => {
            const item = shopPreview;
            const owned = (profile.ownedItems || []).includes(item.id);
            const canAfford = COINS >= item.price;
            const meetsLevel = profile.level >= (item.level || 1);
            const equipped = profile[`equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`] === item.id;
            const displayName = profile.username || "Your Name";
            const equippedBannerItem = SHOP_ITEMS.find(i => i.id === profile.equippedBanner);
            const bannerBg = equippedBannerItem ? equippedBannerItem.preview : "linear-gradient(135deg, #14532d 0%, #22c55e 60%)";
            const bannerAnimClass = equippedBannerItem?.animated === "shimmer" ? "banner-shimmer" : equippedBannerItem?.animated === "aurora" ? "banner-aurora" : "";
            return (
              <div onClick={() => setShopPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 350 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "calc(85vh - env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Header — fixed */}
                  <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px", borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>🪙 {item.price.toLocaleString()}</div>
                    </div>
                    <button onClick={() => setShopPreview(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>

                  {/* Preview area — scrollable */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <div style={{ background: "#f9fafb", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, border: "1px solid #e5e7eb" }}>
                    {/* BANNER */}
                    {item.type === "banner" && (
                      <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ width: "100%", height: 90, background: item.preview, borderRadius: 12 }} className={item.animated === "shimmer" ? "banner-shimmer" : item.animated === "aurora" ? "banner-aurora" : ""} />
                        <div style={{ background: "#fff", borderRadius: "0 0 12px 12px", padding: "12px 14px", border: "1px solid #e5e7eb", borderTop: "none", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {profilePic ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{displayName}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>OVR {profile.ovr || 60}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* BORDER */}
                    {item.type === "border" && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
                        <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: 60, background: bannerBg }} className={bannerAnimClass} />
                          <div style={{ background: "#fff", padding: "12px 14px 14px", display: "flex", alignItems: "center", gap: 12, borderTop: "none" }}>
                            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e5e7eb", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...item.style }}>
                              {profilePic
                                ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                                : <span style={{ fontSize: 28, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{displayName}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>OVR {profile.ovr || 60}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* NAMEPLATE */}
                    {item.type === "nameplate" && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
                        <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: 70, background: bannerBg }} className={bannerAnimClass} />
                          <div style={{ background: "#fff", padding: "14px 18px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {profilePic
                                ? <img src={profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 22, fontWeight: 900, color: "#6b7280" }}>{(profile.username || "?")[0].toUpperCase()}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, ...item.style }}>{displayName}</div>
                              <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: 1.5 }}>OVR {profile.ovr || 60}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>{/* end scrollable area */}

                  {/* Action buttons — fixed at bottom */}
                  <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #f3f4f6" }}>
                    <button onClick={() => setShopPreview(null)} style={{ flex: 1, padding: 13, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>Close</button>
                    {owned ? (
                      <button onClick={() => {
                        const key = `equipped${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`;
                        setProfile(p => ({ ...p, [key]: p[key] === item.id ? null : item.id }));
                        setShopPreview(null);
                      }} style={{ flex: 1, padding: 13, background: equipped ? "#f3f4f6" : Theme.primaryGreen, border: `1px solid ${equipped ? "#e5e7eb" : Theme.primaryGreen}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", color: equipped ? "#374151" : "#fff" }}>
                        {equipped ? "Unequip" : "Equip"}
                      </button>
                    ) : (
                      <button onClick={() => { setShopPreview(null); setShopConfirm(item); }} disabled={!canAfford || !meetsLevel} style={{ flex: 1, padding: 13, background: canAfford && meetsLevel ? Theme.primaryGreen : "#f3f4f6", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: canAfford && meetsLevel ? "pointer" : "default", color: canAfford && meetsLevel ? "#fff" : "#9ca3af" }}>
                        {!meetsLevel ? `Requires Lvl ${item.level}` : !canAfford ? "Not enough coins" : `Buy · 🪙 ${item.price.toLocaleString()}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Shop confirm modal */}
          {/* ── COIN PURCHASE MODAL ── */}
          {coinShopPack && (
            <div onClick={() => { if (!coinPaymentBusy) { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentSuccess(false); setCoinPaymentError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 36px", boxSizing: "border-box" }}>
                {coinPaymentSuccess ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🪙</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Bebas Neue", letterSpacing: 1, marginBottom: 6 }}>COINS ADDED!</div>
                    <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>+{coinShopPack.coins.toLocaleString()} coins have been added to your account.</div>
                    <button onClick={() => { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentSuccess(false); }} style={{ width: "100%", padding: 14, background: Theme.primaryGreen, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Done</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{coinShopPack.label} Pack</div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>🪙 {coinShopPack.coins.toLocaleString()} coins · ${coinShopPack.price.toFixed(2)}</div>
                      </div>
                      <button onClick={() => { setCoinShopPack(null); setCoinClientSecret(null); setCoinPaymentError(""); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: "#6b7280" }}>✕</button>
                    </div>
                    {coinPaymentError && !coinClientSecret ? (
                      <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 16, lineHeight: 1.5 }}>{coinPaymentError}</div>
                        <button onClick={() => handleSelectCoinPack(coinShopPack)} style={{ padding: "10px 24px", background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Try Again</button>
                      </div>
                    ) : !coinClientSecret ? (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Setting up payment...</div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: 0.5 }}>CARD DETAILS</div>
                          <div ref={mountCardElement} style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "14px 12px", background: "#fafafa", minHeight: 44 }} />
                        </div>
                        {coinPaymentError && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, textAlign: "center" }}>{coinPaymentError}</div>}
                        <button onClick={handleCoinPayment} disabled={coinPaymentBusy} style={{ width: "100%", padding: 14, background: coinPaymentBusy ? "#e5e7eb" : Theme.primaryGreen, border: "none", borderRadius: 12, color: coinPaymentBusy ? "#9ca3af" : "#fff", fontWeight: 800, fontSize: 15, cursor: coinPaymentBusy ? "default" : "pointer" }}>
                          {coinPaymentBusy ? "Processing..." : `Pay $${coinShopPack.price.toFixed(2)}`}
                        </button>
                        <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>Secured by Stripe · No card info stored</div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {shopConfirm && (
            <div onClick={() => setShopConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 280, width: "90%", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Buy {shopConfirm.label}?</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Cost: 🪙 {shopConfirm.price.toLocaleString()}<br/>Balance: {COINS.toLocaleString()} → {(COINS - shopConfirm.price).toLocaleString()} coins</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShopConfirm(null)} style={{ flex: 1, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => {
                    const key = `equipped${shopConfirm.type.charAt(0).toUpperCase() + shopConfirm.type.slice(1)}`;
                    let updates = { ownedItems: [...(profile.ownedItems || []), shopConfirm.id], coins: (profile.coins || 0) - shopConfirm.price };
                    if (shopConfirm.type === "boost") {
                      const cur = profile.coinBoost && profile.coinBoost.roundsLeft > 0 ? profile.coinBoost : null;
                      const merged = cur && cur.multiplier === shopConfirm.multiplier ? { ...cur, roundsLeft: cur.roundsLeft + shopConfirm.rounds } : { multiplier: shopConfirm.multiplier, roundsLeft: shopConfirm.rounds };
                      updates.coinBoost = merged;
                    } else { updates[key] = shopConfirm.id; }
                    setProfile(p => ({ ...p, ...updates }));
                    setShopConfirm(null);
                  }} style={{ flex: 1, padding: 12, background: Theme.primaryGreen, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* ── CLUB PICKER MODAL (shot tracking) ── */}
      {pendingShotYards != null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-end", zIndex: 400 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxHeight: "75vh", overflowY: "auto" }}>
            {/* Yardage hero */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 64, fontWeight: 900, fontFamily: "Bebas Neue", color: "#111827", lineHeight: 1 }}>{pendingShotYards}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", letterSpacing: 2 }}>YARDS</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Which club did you hit?</div>
            </div>

            {/* Fairway hit toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1.5, marginBottom: 6 }}>FAIRWAY HIT?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShotInFairway(v => !v)}
                  style={{ flex: 1, padding: "10px 0", border: `2px solid ${shotInFairway ? "#059669" : "#e5e7eb"}`, borderRadius: 10, background: shotInFairway ? "#f0fdf4" : "#fff", color: shotInFairway ? "#059669" : "#9ca3af", fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "all 0.15s" }}
                >
                  {shotInFairway ? "✓ In Fairway  (+ACC)" : "In Fairway?"}
                </button>
              </div>
            </div>

            {/* Round GPS gains so far */}
            {(liveAttrGains.PWR > 0 || liveAttrGains.ACC > 0) && (
              <div style={{ background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: 8, padding: "6px 12px", marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#15803d", letterSpacing: 1 }}>THIS ROUND</div>
                {liveAttrGains.PWR > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>+{liveAttrGains.PWR.toFixed(1)} PWR</div>}
                {liveAttrGains.ACC > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>+{liveAttrGains.ACC.toFixed(1)} ACC</div>}
              </div>
            )}

            {/* Club list */}
            {(() => {
              const clubOrder = ["Driver","3W","4W","5W","7W","2h","3h","4h","2i","3i","4i","5i","6i","7i","8i","9i","PW","AW","GW","SW","LW","48°","50°","52°","54°","56°","58°","60°","Putter"];
              const sorted = [...(profile.bag || [])].map((item, origIdx) => ({ ...item, origIdx })).sort((a, b) => {
                const ai = clubOrder.indexOf(a.club), bi = clubOrder.indexOf(b.club);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
              });
              if (sorted.length === 0) return <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Add clubs in My Bag first</div>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sorted.map(item => {
                    const prevAvg = parseFloat(item.distance) || 0;
                    const count = item.trackedCount || 0;
                    const newAvg = (count === 0 || prevAvg === 0) ? pendingShotYards : Math.round((prevAvg * count + pendingShotYards) / (count + 1));
                    const delta = prevAvg ? newAvg - prevAvg : null;
                    return (
                      <button key={item.origIdx} onClick={() => updateClubAverage(item.origIdx, pendingShotYards)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, cursor: "pointer", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{item.club}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>
                              {prevAvg ? `${prevAvg} yds avg · ${count} tracked` : "No avg yet"}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "Bebas Neue", color: "#059669" }}>{newAvg} yds</div>
                          {delta !== null && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? "#059669" : "#dc2626" }}>
                              {delta >= 0 ? "+" : ""}{delta} new avg
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <button onClick={() => {
              // Roll back the stroke that was pre-incremented on FOUND BALL tap
              setLiveStrokesArr(a => { const n = [...a]; if (liveRound && n[liveRound.currentHole] > 0) n[liveRound.currentHole]--; return n; });
              setLiveRound(r => { if (!r) return r; const sc = [...r.scores]; if ((sc[r.currentHole] ?? 0) > 0) sc[r.currentHole]--; const next = { ...r, scores: sc }; if (authUser && !roundSubmittedRef.current) setDoc(doc(db, "users", authUser.uid), { liveRound: next }, { merge: true }).catch(() => {}); return next; });
              setPendingShotEndPos(null);
              setPendingShotYards(null);
            }} style={{ width: "100%", marginTop: 14, padding: "12px 0", background: "#f3f4f6", border: "none", borderRadius: 10, color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── ATTR TOAST ── */}
      {attrToast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 500, background: "#111827", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#a3e635", letterSpacing: 0.5 }}>{attrToast}</span>
        </div>
      )}

      {/* ── CREATE COURSE MODAL ── */}
      {showCreateCourse && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#f4f5f7", overflowY: "auto" }}>
          <div style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button onClick={() => setShowCreateCourse(false)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#374151" }}>← Back</button>
              <div style={{ fontSize: 24, fontFamily: "Bebas Neue", letterSpacing: 2 }}>NEW COURSE</div>
            </div>
            {/* Info banner */}
            <div style={{ margin: "0 16px 14px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>⭐</span>
              <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                Saved as <strong>Community</strong> until 5 players confirm GPS coordinates match. Your hole positions are captured silently each time you advance.
              </div>
            </div>
            {/* Course name + location */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 6 }}>COURSE NAME *</div>
              <input value={newCourseForm.courseName} onChange={e => setNewCourseForm(f => ({ ...f, courseName: e.target.value }))} placeholder="e.g. Brown Deer Park Golf Course" style={{ ...S.fInput, marginBottom: 12 }} />
              <div style={{ ...S.fLabel, marginBottom: 6 }}>LOCATION (CITY, STATE)</div>
              <input value={newCourseForm.location} onChange={e => setNewCourseForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Milwaukee, WI" style={S.fInput} />
            </div>
            {/* Tee color + rating + slope */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 6 }}>TEE COLOR</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[{ label: "Black", dot: "#111827", dotOpacity: 0.8 }, { label: "Blue", dot: "#3b82f6", dotOpacity: 0.8 }, { label: "White", dot: "#e5e7eb", border: "#9ca3af" }, { label: "Gold", dot: "#f59e0b", dotOpacity: 0.8 }, { label: "Red", dot: "#ef4444" }].map(t => {
                  const active = newCourseForm.teeColor === t.label;
                  return (
                    <button key={t.label} onClick={() => setNewCourseForm(f => ({ ...f, teeColor: t.label }))} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: active ? `2px solid ${t.border || t.dot}` : "1px solid #e5e7eb", background: active ? "#f9fafb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 11, color: Theme.textMain }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.dot, border: t.border ? `1px solid ${t.border}` : "none", opacity: t.dotOpacity ?? 1 }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.fLabel, marginBottom: 4 }}>COURSE RATING *</div>
                  <input value={newCourseForm.rating} onChange={e => setNewCourseForm(f => ({ ...f, rating: e.target.value }))} placeholder="72.4" style={S.fInput} type="number" step="0.1" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.fLabel, marginBottom: 4 }}>SLOPE *</div>
                  <input value={newCourseForm.slope} onChange={e => setNewCourseForm(f => ({ ...f, slope: e.target.value }))} placeholder="128" style={S.fInput} type="number" />
                </div>
              </div>
            </div>
            {/* Holes + par grid */}
            <div style={{ margin: "0 16px 12px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 8 }}>HOLES PLAYED</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {["9", "18"].map(h => (
                  <button key={h} onClick={() => setNewCourseForm(f => ({ ...f, holes: h }))} style={{ flex: 1, padding: "9px 0", background: newCourseForm.holes === h ? ACCENT : "#f9fafb", border: newCourseForm.holes === h ? `1.5px solid ${ACCENT}` : "1px solid #e5e7eb", borderRadius: 7, color: newCourseForm.holes === h ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
                    {h} HOLES
                  </button>
                ))}
              </div>
              <div style={{ ...S.fLabel, marginBottom: 8 }}>HOLE PARS — TAP TO CYCLE 3→4→5</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                {Array.from({ length: parseInt(newCourseForm.holes) }, (_, i) => {
                  const par = newCourseForm.holePars[i];
                  const bg = par === 3 ? "#dbeafe" : par === 5 ? "#fef9c3" : "#f0fdf4";
                  const border = par === 3 ? "#93c5fd" : par === 5 ? "#fef08a" : "#86efac";
                  return (
                    <button key={i} onClick={() => setNewCourseForm(f => { const p = [...f.holePars]; p[i] = p[i] === 5 ? 3 : p[i] + 1; return { ...f, holePars: p }; })} style={{ padding: "5px 0", borderRadius: 6, background: bg, border: `1px solid ${border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <div style={{ fontSize: 7, color: "#9ca3af", fontWeight: 700 }}>H{i + 1}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", lineHeight: 1 }}>{par}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Yardages (optional) */}
            <div style={{ margin: "0 16px 16px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px" }}>
              <div style={{ ...S.fLabel, marginBottom: 2 }}>YARDAGES PER HOLE (OPTIONAL)</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 10 }}>Helps GPS club recommendations. You can leave these blank.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {Array.from({ length: parseInt(newCourseForm.holes) }, (_, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", marginBottom: 2, letterSpacing: 0.5 }}>H{i + 1} · P{newCourseForm.holePars[i]}</div>
                    <input value={newCourseForm.holeYards[i]} onChange={e => setNewCourseForm(f => { const y = [...f.holeYards]; y[i] = e.target.value; return { ...f, holeYards: y }; })} placeholder="yds" type="number" style={{ ...S.fInput, fontSize: 12, padding: "7px 8px" }} />
                  </div>
                ))}
              </div>
            </div>
            {/* Submit */}
            <div style={{ padding: "0 16px" }}>
              {(!newCourseForm.courseName.trim() || !newCourseForm.rating || !newCourseForm.slope) && (
                <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 8 }}>Course name, rating, and slope are required.</div>
              )}
              <button onClick={handleCreateCourse} disabled={!newCourseForm.courseName.trim() || !newCourseForm.rating || !newCourseForm.slope} style={{ width: "100%", padding: "16px 0", background: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? ACCENT : "#e5e7eb", border: "none", borderRadius: 12, color: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "#fff" : "#9ca3af", fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "pointer" : "default", fontFamily: "Bebas Neue", boxShadow: (newCourseForm.courseName.trim() && newCourseForm.rating && newCourseForm.slope) ? "0 4px 14px rgba(34,197,94,0.3)" : "none" }}>
                CREATE &amp; START ROUND
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
