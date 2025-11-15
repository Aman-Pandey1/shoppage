import React from "react";
import {
  User,
  Home as HomeIcon,
  ShoppingCart,
  Phone,
  ChevronDown,
} from "lucide-react";
import { fetchJson, getCurrentUser, logout, resolveAssetUrl } from "../lib/api";
import { useNavigate } from "react-router-dom";

export const TopNav = ({
  siteSlug = "default",
  onSignIn,
  onOpenCart,
  cartCount = 0,
  isCartOpen = false,
  orderType,
  onChangeOrderType,
  locations = [],
  setSelectedLocation,
  selectedLocation,
  setSelectedPickupCity,
  pickupDate,
  onPickupDateChange,
  dateOptions,
  pickupTime,
  onPickupTimeChange,
  timeOptions,
}) => {
  const [site, setSite] = React.useState({ name: "Store" });
  const [primaryLocation, setPrimaryLocation] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  const user = getCurrentUser();
  const navigate = useNavigate();

  // DATE & TIME
  const formattedDateOptions = dateOptions.length
    ? dateOptions
    : [
        { value: "today", label: "Today" },
        { value: "tomorrow", label: "Tomorrow" },
      ];

  const formattedTimeOptions = timeOptions.length
    ? timeOptions
    : (() => {
        const out = [];
        let h = 10,
          m = 0; // 10:00 AM to 10:00 PM opening
        // last order 9:45 PM
        let endH = 21,
          endM = 45;
        while (h < endH || (h === endH && m <= endM)) {
          const mod = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 === 0 ? 12 : h % 12;
          const label = `${h12}:${String(m).padStart(2, "0")} ${mod}`;
          out.push({ value: label, label });
          m += 15;
          if (m >= 60) {
            m -= 60;
            h += 1;
          }
        }
        return out;
      })();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setSite(data || {});
          try {
            // Prefer explicit headerColor if provided; fallback to brandColor; then default red theme
            const base =
              data && (data.headerColor || data.brandColor)
                ? data.headerColor || data.brandColor
                : "#ea5a4b";
            document.documentElement.style.setProperty("--primary", base);
            document.documentElement.style.setProperty("--primary-600", base);
            const rgba = (hex, a) => {
              const h = String(hex || "").replace("#", "");
              if (!/^([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(h))
                return `rgba(14,165,233,${a})`;
              const full =
                h.length === 3
                  ? h
                      .split("")
                      .map((c) => c + c)
                      .join("")
                  : h;
              const bigint = parseInt(full, 16);
              const r = (bigint >> 16) & 255;
              const g = (bigint >> 8) & 255;
              const b = bigint & 255;
              return `rgba(${r},${g},${b},${a})`;
            };
            document.documentElement.style.setProperty(
              "--primary-alpha-04",
              rgba(base, 0.04)
            );
            document.documentElement.style.setProperty(
              "--primary-alpha-08",
              rgba(base, 0.08)
            );
            document.documentElement.style.setProperty(
              "--primary-alpha-12",
              rgba(base, 0.12)
            );
            document.documentElement.style.setProperty(
              "--primary-alpha-18",
              rgba(base, 0.18)
            );
            document.documentElement.style.setProperty(
              "--primary-alpha-22",
              rgba(base, 0.22)
            );
            document.documentElement.style.setProperty(
              "--primary-alpha-25",
              rgba(base, 0.25)
            );
          } catch {}
        }
      } catch {}
    }
    async function loadPrimaryLocation() {
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/locations`);
        if (!cancelled) {
          const arr = Array.isArray(list) ? list : [];
          setPrimaryLocation(arr[0] || null);
        }
      } catch {
        if (!cancelled) setPrimaryLocation(null);
      }
    }
    load();
    loadPrimaryLocation();
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  // Track window width for responsive behavior
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const name = site?.name || "Store";
  const tagline = typeof site?.tagline === "string" ? site.tagline : "";
  const supportWhatsappPhone = (
    typeof site?.supportWhatsappPhone === "string"
      ? site.supportWhatsappPhone
      : ""
  ).trim();
  // Prefer explicitly configured support number; fallback to pickup phone if needed
  const supportPhone =
    supportWhatsappPhone ||
    (typeof site?.pickup?.phone === "string" ? site.pickup.phone.trim() : "");
  const telHref = React.useMemo(
    () =>
      supportPhone ? `tel:${String(supportPhone).replace(/[^+\d]/g, "")}` : "",
    [supportPhone]
  );
  const addressLine = React.useMemo(() => {
    try {
      if (!primaryLocation || !primaryLocation.address) return "";
      const parts = [
        ...(Array.isArray(primaryLocation.address.streetAddress)
          ? primaryLocation.address.streetAddress
          : []),
        primaryLocation.address.city,
        primaryLocation.address.province,
        primaryLocation.address.postalCode,
      ].filter(Boolean);
      return parts.join(", ");
    } catch {
      return "";
    }
  }, [primaryLocation]);
  const rawLogoUrl = site?.logoUrl || "";
  const logoLinkUrl = (
    typeof site?.logoLinkUrl === "string" ? site.logoLinkUrl : ""
  ).trim();
  const resolvedBackendLogo = React.useMemo(
    () => resolveAssetUrl(rawLogoUrl),
    [rawLogoUrl]
  );
  const logoCandidates = React.useMemo(() => {
    try {
      const list = [];
      // 1) Backend absolute URL (API_BASE_URL + relative or passthrough for absolute)
      if (resolvedBackendLogo) list.push(resolvedBackendLogo);
      // 2) Same-origin relative URL fallback (helps when backend is reverse-proxied)
      if (rawLogoUrl && typeof window !== "undefined") {
        const path = rawLogoUrl.startsWith("/") ? rawLogoUrl : `/${rawLogoUrl}`;
        const sameOrigin = `${window.location.origin}${path}`;
        if (!list.includes(sameOrigin)) list.push(sameOrigin);
      }
      return list;
    } catch {
      return resolvedBackendLogo ? [resolvedBackendLogo] : [];
    }
  }, [resolvedBackendLogo, rawLogoUrl]);
  const initials = React.useMemo(() => {
    if (!user?.email) return "FR";
    const base = (user?.email?.split("@")[0] || "").replace(/[^A-Za-z]/g, "");
    return base.slice(0, 2).toUpperCase() || "FR";
  }, [user?.email]);

  // Track broken logo URLs to show graceful fallback and reset when URL changes
  const [logoIndex, setLogoIndex] = React.useState(0);
  React.useEffect(() => {
    setLogoIndex(0);
  }, [logoCandidates.map(String).join("|")]);

  // Check if screen is desktop (1024px and above)
  const isDesktop = windowWidth >= 1024;

  return (
    <div
      className="top-nav shadow-lg"
      data-menu-open={menuOpen ? "true" : "false"}
      role="banner"
      style={{
        zIndex: menuOpen ? 900 : undefined,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="top-nav__inner">
        {/* Left: Home pill */}
        <div
          className="brand h-full flex flex-col justify-center items-start gap-2 text-black font-semibold"
          aria-label="Store brand"
        >
          <label
            htmlFor=""
            className=" flex justify-start items-center gap-3 relative"
          >
            <span className=" text-sm">Order Type:</span>
            <input
              type="text"
              readOnly
              value={orderType}
              size={Math.max(orderType?.length || 1, 1)}
              onClick={onChangeOrderType}
              className=" w-fit flex-shrink cursor-pointer text-xs text-black border-0 rounded-none border-b-2 border-black p-2 font-medium"
            />
            <ChevronDown className=" absolute top-1/2 right-2 -translate-y-1/2 size-6 md:size-4 pointer-events-none " />
          </label>
          <label
            htmlFor=""
            className=" flex justify-start items-center gap-3 relative"
          >
            <span className=" text-sm">Location:</span>
            <RestaurantLocation
              locations={locations}
              setSelectedLocation={setSelectedLocation}
              selectedLocation={selectedLocation}
              setSelectedPickupCity={setSelectedPickupCity}
            />
            <ChevronDown className=" absolute top-1/2 right-2 -translate-y-1/2 size-6 md:size-4 pointer-events-none " />
          </label>
        </div>
        {/* Center: Logo only */}
        <div className="nav-title" style={{ justifySelf: "center" }}>
          <a
            className="brand__logo"
            aria-label="Home"
            href={logoLinkUrl || undefined}
            onClick={(e) => {
              if (!logoLinkUrl) return; // no link configured
              if (logoLinkUrl.startsWith("http")) return; // let browser handle external link
              e.preventDefault();
              try {
                navigate(logoLinkUrl);
              } catch {
                window.location.href = logoLinkUrl;
              }
            }}
            style={{ cursor: logoLinkUrl ? "pointer" : "default" }}
          >
            {logoCandidates.length > 0 && logoIndex < logoCandidates.length ? (
              <img
                src={logoCandidates[logoIndex]}
                alt="logo"
                className=" object-contain object-center"
                onError={() => setLogoIndex((i) => i + 1)}
              />
            ) : (
              <span aria-hidden style={{ fontSize: 26 }}>
                🍽️
              </span>
            )}
          </a>
        </div>

        <div
          className="actions h-full"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <div className=" flex-1 flex flex-col justify-center items-end gap-2">
            <p className="text-black font-semibold flex justify-center items-center gap-2 pr-4">
              <span className=" text-sm">Phone Number:</span>
              <a
                href={telHref}
                aria-label="Call support"
                title={`Call ${supportPhone}`}
                className=" font-medium"
              >
                <span className="hide-mobile text-xs text-black pb-2 border-b-2 border-black">{supportPhone}</span>
              </a>
            </p>

            <label
              htmlFor=""
              className="flex justify-start items-center gap-3 relative text-black font-semibold"
            >
              <span className=" text-sm">Order Date/Time:</span>
              <RestaurantDateTime
                formattedDateOptions={formattedDateOptions}
                formattedTimeOptions={formattedTimeOptions}
                onPickupDateChange={onPickupDateChange}
                onPickupTimeChange={onPickupTimeChange}
                pickupDate={pickupDate}
                pickupTime={pickupTime}
              />
            </label>
          </div>
          {/* Mobile: Cart + Account buttons */}
          {!isDesktop && (
            <>
              <button
                className="cart-header-btn"
                aria-label="Open cart"
                onClick={() => {
                  if (typeof onOpenCart === "function") onOpenCart();
                }}
                title="Cart"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#111827",
                  border: "1px solid #111827",
                  cursor: "pointer",
                  position: "relative",
                  padding: "8px",
                  overflow: "visible",
                }}
              >
                <ShoppingCart size={18} color="#fff" />
                {Number(cartCount) > 0 ? (
                  <span
                    className="cart-header-badge"
                    aria-label={`Items in cart: ${cartCount}`}
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      background: "#ff4444",
                      color: "white",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      fontSize: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {cartCount}
                  </span>
                ) : null}
              </button>
              <button
                className="account-header-btn"
                aria-label="Account menu"
                title="Account"
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#111827",
                  border: "1px solid #111827",
                  borderRadius: 999,
                  color: "#fff",
                  cursor: "pointer",
                  padding: "6px 10px",
                }}
              >
                {user ? (
                  <span
                    style={{ fontWeight: 800, fontSize: 12, color: "#fff" }}
                  >
                    {initials}
                  </span>
                ) : (
                  <User size={16} color="#fff" />
                )}
              </button>
            </>
          )}

          {/* Desktop: account chip remains; hidden on mobile */}
          <button
            className="profile-chip hide-mobile"
            aria-label="Account"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: "#111827",
              color: "#fff",
              border: "1px solid #111827",
              borderRadius: 999,
              padding: "6px 10px",
            }}
          >
            {user ? (
              <span style={{ color: "#fff" }}>{initials}</span>
            ) : (
              <User size={16} color="#fff" />
            )}
          </button>
          {menuOpen ? (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                padding: 8,
                borderRadius: 12,
                minWidth: 220,
                zIndex: 1200, // ensure above banner and cart
                background: "white",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                border: "1px solid #e2e8f0",
              }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div style={{ padding: "6px 10px", fontWeight: 700 }}>
                {user?.email || "Account"}
              </div>
              <button
                style={{
                  width: "100%",
                  textAlign: "left",
                  marginTop: 4,
                  padding: "6px 10px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setMenuOpen(false);
                  navigate(`/s/${siteSlug}/orders`);
                }}
              >
                My Orders
              </button>
              {!user ? (
                <button
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setMenuOpen(false);
                    onSignIn && onSignIn();
                  }}
                >
                  Login / Register
                </button>
              ) : (
                <button
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    window.location.reload();
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Add CSS for responsive behavior */}
      <style>{`
        @media (min-width: 1024px) {
          .cart-header-btn {
            display: none !important;
          }
        }
        
        @media (max-width: 1023px) {
          .cart-header-btn {
            display: flex !important;
          }
          
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

const RestaurantLocation = ({
  locations,
  setSelectedLocation,
  setSelectedPickupCity,
  selectedLocation,
}) => {
  return (
    <select
      className=" flex-1 bg-transparent text-xs text-black border-0 rounded-none border-b-2 border-black p-2 font-medium remove-arr pr-8"
      value={((idx) => (idx >= 0 ? String(idx) : ""))(
        locations.findIndex((l) => l === selectedLocation)
      )}
      onChange={(e) => {
        const idx = Number(e.target.value);
        const chosen = locations[idx];
        setSelectedLocation(chosen || null);
        setSelectedPickupCity(
          chosen && chosen.address && chosen.address.city
            ? chosen.address.city
            : "All"
        );
        try {
          localStorage.setItem("selectedPickupIndex", String(idx));
        } catch {}
      }}
    >
      {locations.findIndex((l) => l === selectedLocation) < 0 ? (
        <option value="" disabled>
          Select a location
        </option>
      ) : null}
      {locations.map((loc, idx) => (
        <option key={`${loc?.name || "loc"}-${idx}`} value={String(idx)}>
          {loc?.name || "Restaurant"} -{" "}
          {Array.isArray(loc?.address?.streetAddress)
            ? loc.address.streetAddress.join(" ")
            : ""}
          {loc?.address?.city ? `, ${loc.address.city}` : ""}
        </option>
      ))}
    </select>
  );
};

const RestaurantDateTime = ({
  pickupDate,
  onPickupDateChange,
  formattedDateOptions,
  pickupTime,
  onPickupTimeChange,
  formattedTimeOptions,
}) => {
  return (
    <div className=" w-fit bg-transparent text-black border-0 rounded-none border-b-2 border-black p-2 font-medium flex justify-center items-center gap-0">
      {/* DATE */}
      <div className=" w-fit relative">
        <ChevronDown className=" absolute top-1/2 right-2 -translate-y-1/2 size-6 md:size-4 pointer-events-none " />
        <select
          className=" font-medium remove-arr p-1 pr-8 rounded-none bg-transparent text-black border-0 relative text-xs"
          value={pickupDate}
          onChange={(e) =>
            onPickupDateChange && onPickupDateChange(e.target.value)
          }
        >
          {formattedDateOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {/* TIME */}
      <div className=" w-fit relative">
        <ChevronDown className=" absolute top-1/2 right-2 -translate-y-1/2 size-6 md:size-4 pointer-events-none " />
        <select
          className=" font-medium remove-arr p-1 pr-8 rounded-none bg-transparent text-black border-0 relative text-xs"
          value={pickupTime}
          onChange={(e) =>
            onPickupTimeChange && onPickupTimeChange(e.target.value)
          }
        >
          {formattedTimeOptions.map((t) => (
            <option
              key={t.value || t}
              value={t.value || t}
              disabled={!!t.disabled}
            >
              {t.label || t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// saved for reference
//          {logoLinkUrl ? (
//   <a
//     className="brand__home"
//     href={logoLinkUrl || undefined}
//     onClick={(e) => {
//       if (!logoLinkUrl) return;
//       if (logoLinkUrl.startsWith('http')) return; // external
//       e.preventDefault();
//       try { navigate(logoLinkUrl); } catch { window.location.href = logoLinkUrl; }
//     }}
//     style={{
//       display: 'inline-flex',
//       alignItems: 'center',
//       gap: 8,
//       padding: '6px 12px',
//       borderRadius: 999,
//       border: '1px solid #111827',
//       background: '#111827',
//       color: '#fff',
//       fontWeight: 800,
//       fontSize: 12,
//     }}
//   >
//     <HomeIcon size={16} color="#fff" />
//     Home
//   </a>
// ) : null}
