import React, { useState } from "react";
import { useCategoriesQuery, useProductsQuery } from "./lib/queries";
import { hasAnyOptionsDeep } from "./lib/optionsTree";
import { QuickAddModal } from "./components/QuickAddModal";


const ProductListwithCategory = ({
  onSelect,
  siteSlug = "default",
  selectedCategory, // null/undefined = "All"
  vegFilter,
  onAdd,
}) => {
  const showAll = !selectedCategory;
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  // ----- CATEGORIES -----
  const {
    data: categories = [],
    isLoading: loadingCategories,
    isError: categoriesIsError,
    error: categoriesError,
  } = useCategoriesQuery(siteSlug);

  // ----- PRODUCTS (single hook, reused for All + specific category) -----
  const {
    data: products = [],
    isLoading: loadingProducts,
    isError: productsIsError,
    error: productsError,
  } = useProductsQuery({
    siteSlug,
    // when no category is selected ("All"), pass null/undefined
    categoryId: selectedCategory?._id ?? null,
    vegFilter,
    enabled: showAll ? true : undefined,
  });

  // ----- CATEGORY COUNTS (optional, like before) -----
  const counts = React.useMemo(() => {
    if (!Array.isArray(categories)) return {};
    return categories.reduce((acc, cat) => {
      if (!cat?._id) return acc;
      const id = String(cat._id);
      const value =
        typeof cat.productCount === "number"
          ? cat.productCount
          : Array.isArray(cat.products)
          ? cat.products.length
          : undefined;
      if (typeof value === "number") acc[id] = value;
      return acc;
    }, {});
  }, [categories]);

  const totalCount = React.useMemo(
    () =>
      Object.values(counts).reduce(
        (sum, val) => (typeof val === "number" ? sum + val : sum),
        0
      ),
    [counts]
  );

  // ----- BUILD products array: [{ category, products: [...] }, ... ] -----
  const productsByCategory = React.useMemo(() => {
    if (!Array.isArray(products)) return [];

    // If a specific category is selected, we assume the API already filtered
    // and just wrap the products into one group.
    if (!showAll && selectedCategory) {
      return [
        {
          category: selectedCategory,
          products: products,
        },
      ];
    }

    // "All" selected: group products by category
    const map = new Map();

    // prepare groups for all categories
    categories.forEach((cat) => {
      if (!cat?._id) return;
      const id = String(cat._id);
      map.set(id, { category: cat, products: [] });
    });

    // helper to find category id on each product
    const getProductCategoryId = (p) => {
      if (p.categoryId) return String(p.categoryId);
      if (p.category?._id) return String(p.category._id);
      if (p.category) return String(p.category);
      return null;
    };

    // put each product in the right bucket
    products.forEach((p) => {
      const cid = getProductCategoryId(p);
      if (!cid) return;
      const group = map.get(cid);
      if (group) {
        group.products.push(p);
      }
    });

    return Array.from(map.values());
  }, [products, categories, showAll, selectedCategory]);

  // ----- LOADING / ERROR STATES -----
  if (loadingCategories) {
    return (
      <div className="w-full h-[calc(100dvh-144px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading categories…</span>
        </div>
      </div>
    );
  }

  if (categoriesIsError) {
    return (
      <div className="w-full h-[calc(100dvh-144px)] flex items-center justify-center">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          Failed to load categories:{" "}
          {categoriesError?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  if (productsIsError) {
    return (
      <div className="w-full h-[calc(100dvh-144px)] flex items-center justify-center">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          Failed to load products: {productsError?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  // ----- SELECTION HELPERS -----
  const isCatSelected = (cat) =>
    selectedCategory && selectedCategory._id === cat._id;

  const isAllSelected = !selectedCategory;

  return (
    <div className="w-full md:h-[calc(100dvh-144px)] overflow-hidden flex flex-col md:flex-row justify-center items-start gap-2 relative md:top-0 top-[350px]">
      {/* CATEGORY SIDEBAR */}
      <aside className="md:w-1/4 w-full md:max-w-xs h-full md:sticky relative md:top-4">
        <div className="h-full bg-white border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold tracking-[0.15em] text-slate-500 uppercase">
              Categories
            </h3>
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-auto px-2 py-2 space-y-1">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-1">
                No categories available.
              </p>
            ) : (
              <>
                {/* ALL CATEGORY */}
                <button
                  type="button"
                  onClick={() => onSelect(null)}
                  aria-pressed={isAllSelected}
                  className={`group w-full flex items-center justify-between rounded-sm gap-2 px-3 py-2 text-sm transition-all
                    ${
                      isAllSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                    }`}
                >
                  <span className="truncate text-left">All</span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0
                      ${
                        isAllSelected
                          ? "bg-blue-500/60 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                  >
                    {totalCount}
                  </span>
                </button>

                {/* INDIVIDUAL CATEGORIES */}
                {categories.map((cat) => {
                  const selected = isCatSelected(cat);
                  const count = counts[String(cat._id)] ?? 0;

                  return (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => onSelect(cat)}
                      aria-pressed={selected}
                      className={`group w-full flex items-center justify-between rounded-sm gap-2 px-3 py-2 text-sm transition-all
                        ${
                          selected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        }`}
                    >
                      <span className="truncate text-left">
                        {cat.name || "Untitled"}
                      </span>

                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0
                          ${
                            selected
                              ? "bg-blue-500/60 text-white"
                              : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                          }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE CONTENT */}
      <div className="md:w-3/4 w-full h-full overflow-auto">
        <div className="w-full h-full bg-slate-50 border border-slate-200 p-4 space-y-6">
          {loadingProducts ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
              <span className="text-sm font-medium">Loading Products…</span>
            </div>
          ) : productsByCategory.length === 0 ? (
            <p className="text-sm text-slate-500">No products found.</p>
          ) : (
            productsByCategory.map(({ category, products }) => {
              const key = category?._id || "all";
              const title = category?.name || "All Products";

              return (
                <section key={key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p aria-hidden></p>
                    <h2 className="text-lg font-semibold text-slate-800">
                      {title}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {products.length} item{products.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* PICKUP ONLY BANNER */}
                  {category?.pickupOnly ? (
                    <div
                      className="animate-fadeInUp mt-2 text-xs rounded-lg border px-3 py-2"
                      style={{
                        color: "#92400e",
                        background: "#fef3c7",
                        borderColor: "#fde68a",
                      }}
                    >
                      This category is pickup only. Delivery is not available
                      for these items.
                    </div>
                  ) : null}

                  {products.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No products in this category.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {products.map((p) => {
                        const hasVariants =
                          Array.isArray(p?.variants) && p.variants.length > 0;
                        const hasSpice =
                          Array.isArray(p?.spiceLevels) &&
                          p.spiceLevels.length > 0;
                        const hasExtras = hasAnyOptionsDeep(
                          p?.extraOptionGroups
                        );
                        const hasFreeIncluded = hasAnyOptionsDeep(
                          p?.freeOptionGroups
                        );
                        const needsCustomization =
                          hasVariants ||
                          hasSpice ||
                          hasExtras ||
                          hasFreeIncluded;

                        const variantsSummary =
                          hasVariants &&
                          (() => {
                            try {
                              const list = p.variants.slice(0, 3).map((v) => {
                                const price = Number(v?.price || 0);
                                return `${v?.label || v?.key || "Variant"}${
                                  price ? ` (+$${price.toFixed(2)})` : ""
                                }`;
                              });
                              const extra =
                                p.variants.length > 3
                                  ? ` +${p.variants.length - 3} more`
                                  : "";
                              return `Select Item: ${list.join(", ")}${extra}`;
                            } catch {
                              return "Select Item available";
                            }
                          })();

                        const ariaLabel = needsCustomization
                          ? `Customize ${p.name}`
                          : `Add ${p.name}`;

                        return (
                          <article
                            key={p._id}
                            className="group relative bg-white border border-slate-200 rounded-lg p-3 text-sm flex justify-between items-start gap-3
                                 transition-all duration-200 ease-out
                                 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 hover:bg-blue-50/80"
                          >
                            {/* Left: veg icon + name + description + variants */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-base" aria-hidden>
                                  {p.isVeg === false ? "🔴" : "🟢"}
                                </div>
                                <div className="font-semibold text-slate-800 truncate group-hover:text-blue-700">
                                  {p.name}
                                </div>
                              </div>

                              {p.description ? (
                                <div className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2">
                                  {p.description}
                                </div>
                              ) : null}

                              {variantsSummary ? (
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {variantsSummary}
                                </div>
                              ) : null}
                            </div>

                            {/* Right: price + add/customize button */}
                            <div className="grid justify-items-end gap-2">
                            {/* Price pill */}
                            <div className="inline-flex items-baseline gap-1 rounded-full bg-emerald-50 px-3 py-1 shadow-sm">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                                Price
                                </span>
                                <span className="text-sm font-semibold text-emerald-900">
                                {`$${Number(p.price || 0).toFixed(2)}`}
                                </span>
                            </div>

                            {/* Add / Customize button */}
                            <button
                                onClick={() => {
                                if (needsCustomization) {
                                    onAdd({
                                    product: p,
                                    quantity: 1,
                                    pickupOnlyCategory: !!category?.pickupOnly,
                                    });
                                    return;
                                }
                                setActiveProduct(p);
                                setQuickAddOpen(true);
                                }}
                                className="
                                flex items-center justify-center
                                w-9 h-9 rounded-full
                                border border-blue-500
                                bg-white text-blue-600 text-base font-bold
                                shadow-sm
                                transition-all duration-150 ease-out
                                hover:bg-blue-500 hover:text-white hover:-translate-y-0.5 hover:shadow-md
                                active:scale-95
                                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                                "
                                aria-label={ariaLabel}
                                title={ariaLabel}
                            >
                                +
                            </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          open={quickAddOpen}
          product={activeProduct}
          onCancel={() => {
            setQuickAddOpen(false);
            setActiveProduct(null);
          }}
          onConfirm={(qty) => {
            const prod = activeProduct;
            setQuickAddOpen(false);
            setActiveProduct(null);
            onAdd({
              product: prod,
              quantity: Math.max(1, Math.min(99, Number(qty) || 1)),
              pickupOnlyCategory: !!category?.pickupOnly,
            });
          }}
        />
      )}
    </div>
  );
};

export default ProductListwithCategory;
