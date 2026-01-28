/* =========================
   GarageCRM - JavaScript
   Clean, Modern Implementation
========================= */

// Supabase Configuration
const SUPABASE_URL = "https://yozjketagpvlkvqvoejc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sZ7MIcZMu5GikRU4HD-ftw_gPyQIFqo";

// Service Prediction Config
const SERVICE_INTERVAL_DAYS = 90;
const SERVICE_INTERVAL_KM = 5000;

// App State
const state = {
    supabase: null,
    session: null,
    user: null,
    workshop: null,
    customers: [],
    rawCustomers: [],
    serviceEntries: [],
    selectedCustomerId: null,
    editingCustomerId: null,
    statusMode: "service", // "service" or "insurance"
    filters: {
        search: "",
        sort: "ins_asc",
        sortDirection: "asc",  // asc or desc
        insurance: "all",  // all, 0-30, 0-60, expired
        service: "all",    // all, 0-30, 0-60, overdue
        status: "all"      // all, overdue, expiring, ok
    }
};

// =========================
// Test Data Generator (Call from console: addTestCustomers())
// =========================
async function addTestCustomers() {
    if (!state.supabase || !state.workshop) {
        console.error("Please login first!");
        toast("error", "Error", "Please login first to add test customers");
        return;
    }

    const indianNames = [
        "Rajesh Kumar", "Amit Sharma", "Sunil Verma", "Priya Singh", "Neha Gupta",
        "Vikram Patel", "Anita Joshi", "Rahul Yadav", "Pooja Mishra", "Deepak Agarwal"
    ];

    const vehicleModels = [
        "Maruti Swift", "Hyundai i20", "Tata Nexon", "Honda City", "Toyota Innova",
        "Mahindra XUV500", "Kia Seltos", "Skoda Octavia", "Volkswagen Polo", "Ford EcoSport"
    ];

    const stateCodes = ["DL", "MH", "UP", "RJ", "GJ", "KA", "TN", "HR", "MP", "WB"];
    const addresses = [
        "Sector 15, Noida", "Andheri West, Mumbai", "Rajouri Garden, Delhi",
        "Vaishali Nagar, Jaipur", "Satellite, Ahmedabad", "Koramangala, Bangalore",
        "Anna Nagar, Chennai", "Sector 21, Gurgaon", "MP Nagar, Bhopal", "Salt Lake, Kolkata"
    ];

    function randomDate(daysAgo, daysRange) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo + Math.floor(Math.random() * daysRange));
        return date.toISOString().split('T')[0];
    }

    function randomFutureDate(daysAhead, daysRange) {
        const date = new Date();
        date.setDate(date.getDate() + daysAhead + Math.floor(Math.random() * daysRange));
        return date.toISOString().split('T')[0];
    }

    function randomVehicleNo() {
        const state = stateCodes[Math.floor(Math.random() * stateCodes.length)];
        const district = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
        const series = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
            String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const number = String(Math.floor(Math.random() * 9000) + 1000);
        return `${state}${district}${series}${number}`;
    }

    function randomMobile() {
        const prefixes = ['98', '97', '96', '95', '94', '93', '91', '90', '88', '87'];
        return prefixes[Math.floor(Math.random() * prefixes.length)] +
            String(Math.floor(Math.random() * 90000000) + 10000000);
    }

    setLoading(true, "Adding test customers...");

    try {
        for (let i = 0; i < 10; i++) {
            // Random insurance expiry: some expired, some expiring soon, some OK
            let insuranceExpiry;
            if (i < 2) {
                insuranceExpiry = randomDate(30, 20); // Expired
            } else if (i < 5) {
                insuranceExpiry = randomFutureDate(5, 25); // Expiring soon (0-30 days)
            } else {
                insuranceExpiry = randomFutureDate(60, 180); // OK (60+ days)
            }

            const customer = {
                name: indianNames[i],
                mobile: randomMobile(),
                vehicle_no: randomVehicleNo(),
                vehicle_model: vehicleModels[i],
                address: addresses[i],
                insurance_expiry: insuranceExpiry,
                workshop_id: state.workshop.id
            };

            const { data: newCustomer, error } = await state.supabase
                .from('customers')
                .insert(customer)
                .select()
                .single();

            if (error) {
                console.error(`Error adding customer ${i + 1}:`, error);
                continue;
            }

            // Add 2-3 service entries for each customer
            const numEntries = Math.floor(Math.random() * 2) + 2;
            let lastOdo = Math.floor(Math.random() * 20000) + 5000;

            for (let j = 0; j < numEntries; j++) {
                const serviceEntry = {
                    customer_id: newCustomer.id,
                    service_date: randomDate(30 + (j * 60), 50),
                    odometer_km: lastOdo,
                    notes: ["Oil change & filter", "General service", "Brake pad replacement", "AC service", "Wheel alignment"][Math.floor(Math.random() * 5)],
                    parts: [
                        { name: "Engine Oil", amount: Math.floor(Math.random() * 500) + 300 },
                        { name: "Oil Filter", amount: Math.floor(Math.random() * 200) + 100 }
                    ],
                    total_cost: Math.floor(Math.random() * 3000) + 1500
                };

                await state.supabase.from('service_entries').insert(serviceEntry);
                lastOdo += Math.floor(Math.random() * 3000) + 2000;
            }

            console.log(`✅ Added customer ${i + 1}: ${customer.name}`);
        }

        // Reload data
        await loadSupabaseData();
        rebuildCustomers();
        refreshUI();

        toast("success", "Done!", "10 test customers added successfully");
        console.log("🎉 All 10 test customers added!");
    } catch (err) {
        toast("error", "Error", err.message || "Failed to add test customers");
        console.error(err);
    } finally {
        setLoading(false);
    }
}

// Make it available globally for console access
window.addTestCustomers = addTestCustomers;

// =========================
// DOM Elements
// =========================
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Pages
const authPage = $("#authPage");
const dashboardPage = $("#dashboardPage");

// Auth Forms
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");
const forgotForm = $("#forgotForm");
const loginFormElement = $("#loginFormElement");
const signupFormElement = $("#signupFormElement");
const forgotFormElement = $("#forgotFormElement");

// Auth Buttons
const btnGoSignup = $("#btnGoSignup");
const btnGoForgot = $("#btnGoForgot");
const btnBackLogin1 = $("#btnBackLogin1");
const btnBackLogin2 = $("#btnBackLogin2");
const btnLogout = $("#btnLogout");

// Dashboard
const workshopName = $("#workshopName");
const modeIndicator = $("#modeIndicator");
const statTotal = $("#statTotal");
const statServiceDue = $("#statServiceDue");
const statPolicyExpiring = $("#statPolicyExpiring");
const statOverdue = $("#statOverdue");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const customersTbody = $("#customersTbody");
const emptyState = $("#emptyState");
const btnAddCustomer = $("#btnAddCustomer");

// Detail Modal
const detailBackdrop = $("#detailBackdrop");
const detailModal = $("#detailModal");
const btnCloseDetail = $("#btnCloseDetail");
const detailAvatar = $("#detailAvatar");
const detailName = $("#detailName");
const detailStatus = $("#detailStatus");
const btnWhatsApp = $("#btnWhatsApp");
const btnCall = $("#btnCall");
const detailMobile = $("#detailMobile");
const detailVehicle = $("#detailVehicle");
const detailAddress = $("#detailAddress");
const detailInsurance = $("#detailInsurance");
const detailNextService = $("#detailNextService");
const detailNextOdo = $("#detailNextOdo");
const serviceHistoryList = $("#serviceHistoryList");
const btnAddService = $("#btnAddService");

// Customer Modal
const customerBackdrop = $("#customerBackdrop");
const customerModal = $("#customerModal");
const customerModalTitle = $("#customerModalTitle");
const btnCloseCustomer = $("#btnCloseCustomer");
const btnCancelCustomer = $("#btnCancelCustomer");
const customerFormElement = $("#customerFormElement");
const custName = $("#custName");
const custMobile = $("#custMobile");
const custVehicleNo = $("#custVehicleNo");
const custVehicleModel = $("#custVehicleModel");
const custAddress = $("#custAddress");
const custInsurance = $("#custInsurance");
const custLastService = $("#custLastService");
const custLastOdo = $("#custLastOdo");
const custNextService = $("#custNextService");
const custNextOdo = $("#custNextOdo");

// Service Modal
const serviceBackdrop = $("#serviceBackdrop");
const serviceModal = $("#serviceModal");
const btnCloseService = $("#btnCloseService");
const btnCancelService = $("#btnCancelService");
const serviceFormElement = $("#serviceFormElement");
const svcDate = $("#svcDate");
const svcOdo = $("#svcOdo");
const svcNotes = $("#svcNotes");
const svcComments = $("#svcComments");
const svcCost = $("#svcCost");
const partsContainer = $("#partsContainer");
const btnAddPart = $("#btnAddPart");

// Loading & Toast
const loadingOverlay = $("#loadingOverlay");
const loadingText = $("#loadingText");
const toastContainer = $("#toastContainer");

// WhatsApp Modal
const whatsappBackdrop = $("#whatsappBackdrop");
const whatsappModal = $("#whatsappModal");
const btnCloseWhatsapp = $("#btnCloseWhatsapp");
const waCustomerName = $("#waCustomerName");
const waVehicle = $("#waVehicle");
const waTodayDate = $("#waTodayDate");
const waInsuranceDate = $("#waInsuranceDate");
const waServiceDate = $("#waServiceDate");
const btnMsgInsurance = $("#btnMsgInsurance");
const btnMsgService = $("#btnMsgService");

// Current WhatsApp customer data
let currentWaCustomer = null;

// =========================
// Utility Functions
// =========================
function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseDateOnly(s) {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDate(s) {
    const d = parseDateOnly(s);
    if (!d) return "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function isoDate(d) {
    if (!(d instanceof Date)) return null;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
}

function diffDays(from, to) {
    return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function normalizeMobile(m) {
    const d = (m || "").replace(/\D/g, "");
    return d.length > 10 ? d.slice(-10) : d;
}

function normalizeVehicle(v) {
    return (v || "").toUpperCase().replace(/[\s\-]/g, "");
}

function money(n) {
    const x = Number(n || 0);
    return "₹" + Math.round(x).toLocaleString("en-IN");
}

function escapeHtml(str) {
    return (str ?? "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================
// Loading & Toast
// =========================
function setLoading(on, text = "Loading...") {
    loadingText.textContent = text;
    loadingOverlay.hidden = !on;
}

function toast(type, title, message) {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : type === "error" ? "❌" : "⚠️";
    t.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
    `;
    toastContainer.appendChild(t);
    setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateX(20px)";
        setTimeout(() => t.remove(), 300);
    }, 4000);
}

// =========================
// Navigation
// =========================
function showAuth(screen = "login") {
    authPage.hidden = false;
    dashboardPage.hidden = true;

    loginForm.hidden = screen !== "login";
    signupForm.hidden = screen !== "signup";
    forgotForm.hidden = screen !== "forgot";
}

function showDashboard() {
    authPage.hidden = true;
    dashboardPage.hidden = false;
}

function updateModeUI() {
    modeIndicator.textContent = "Connected";
}

// =========================
// Supabase
// =========================
function initSupabase() {
    if (!window.supabase?.createClient) return null;
    if (SUPABASE_URL === "PASTE_HERE" || SUPABASE_ANON_KEY === "PASTE_HERE") return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// =========================
// Data Processing
// =========================
function computeCustomerDerived(customer, entries) {
    const sorted = entries.filter(e => e.service_date).sort((a, b) =>
        parseDateOnly(b.service_date) - parseDateOnly(a.service_date)
    );

    const last = sorted[0] || null;
    const lastServiceDate = last?.service_date || null;
    const lastOdo = last?.odometer_km ?? null;

    // Use manual values if provided, otherwise auto-calculate
    let upcomingServiceDate = customer.next_service_date || null;
    let upcomingOdo = customer.next_odometer_km ?? null;

    // Auto-calculate if not manually set
    if (!upcomingServiceDate && lastServiceDate) {
        upcomingServiceDate = isoDate(addDays(parseDateOnly(lastServiceDate), SERVICE_INTERVAL_DAYS));
    }
    if (upcomingOdo === null && typeof lastOdo === "number") {
        upcomingOdo = lastOdo + SERVICE_INTERVAL_KM;
    }

    const now = todayStart();
    const insDate = parseDateOnly(customer.insurance_expiry);
    const upDate = parseDateOnly(upcomingServiceDate);

    const daysToInsurance = insDate ? diffDays(now, insDate) : null;
    const daysToService = upDate ? diffDays(now, upDate) : null;

    let status = { type: "ok", label: "OK" };
    if (daysToService !== null && daysToService < 0) {
        status = { type: "overdue", label: "Service Overdue" };
    } else if (daysToInsurance !== null && daysToInsurance < 0) {
        status = { type: "overdue", label: "Insurance Expired" };
    } else if (daysToInsurance !== null && daysToInsurance <= 30) {
        status = { type: "expiring", label: "Insurance Expiring" };
    } else if (daysToService !== null && daysToService <= 30) {
        status = { type: "expiring", label: "Service Due Soon" };
    }

    return {
        ...customer,
        last_service_date: lastServiceDate,
        last_odometer_km: lastOdo,
        upcoming_service_date: upcomingServiceDate,
        upcoming_odometer_km: upcomingOdo,
        days_to_insurance: daysToInsurance,
        days_to_service: daysToService,
        status,
        _entries: entries
    };
}

function rebuildCustomers() {
    const entriesByCustomer = new Map();
    for (const e of state.serviceEntries) {
        if (!entriesByCustomer.has(e.customer_id)) {
            entriesByCustomer.set(e.customer_id, []);
        }
        entriesByCustomer.get(e.customer_id).push(e);
    }

    state.customers = state.rawCustomers.map(c =>
        computeCustomerDerived(c, entriesByCustomer.get(c.id) || [])
    );
}

// =========================
// Rendering
// =========================
function renderStats() {
    const total = state.customers.length;
    const serviceDue = state.customers.filter(c => c.days_to_service !== null && c.days_to_service >= 0 && c.days_to_service <= 30).length;
    const policyExpiring = state.customers.filter(c => c.days_to_insurance !== null && c.days_to_insurance >= 0 && c.days_to_insurance <= 30).length;
    const overdue = state.customers.filter(c => (c.days_to_service !== null && c.days_to_service < 0) || (c.days_to_insurance !== null && c.days_to_insurance < 0)).length;

    statTotal.textContent = total;
    statServiceDue.textContent = serviceDue;
    statPolicyExpiring.textContent = policyExpiring;
    statOverdue.textContent = overdue;
}

function applyFiltersAndSort() {
    let filtered = [...state.customers];

    // Search
    const q = (state.filters.search || "").trim().toLowerCase();
    if (q) {
        filtered = filtered.filter(c => {
            const vehicle = normalizeVehicle(c.vehicle_no).toLowerCase();
            const mobile = normalizeMobile(c.mobile);
            const name = (c.name || "").toLowerCase();
            return vehicle.includes(q) || mobile.includes(q) || name.includes(q);
        });
    }

    // Insurance filter
    if (state.filters.insurance !== "all") {
        filtered = filtered.filter(c => {
            const days = c.days_to_insurance;
            if (days === null) return false;

            if (state.filters.insurance === "expired") {
                return days < 0;
            } else if (state.filters.insurance === "0-30") {
                return days >= 0 && days <= 30;
            } else if (state.filters.insurance === "0-60") {
                return days >= 0 && days <= 60;
            }
            return true;
        });
    }

    // Service filter
    if (state.filters.service !== "all") {
        filtered = filtered.filter(c => {
            const days = c.days_to_service;
            if (days === null) return false;

            if (state.filters.service === "overdue") {
                return days < 0;
            } else if (state.filters.service === "0-30") {
                return days >= 0 && days <= 30;
            } else if (state.filters.service === "0-60") {
                return days >= 0 && days <= 60;
            }
            return true;
        });
    }

    // Status filter
    if (state.filters.status !== "all") {
        filtered = filtered.filter(c => {
            return c.status.type === state.filters.status;
        });
    }

    // Sort
    const dir = state.filters.sortDirection === "desc" ? -1 : 1;

    if (state.filters.sort === "ins_asc") {
        filtered.sort((a, b) => {
            if (a.days_to_insurance === null) return 1;
            if (b.days_to_insurance === null) return -1;
            return (a.days_to_insurance - b.days_to_insurance) * dir;
        });
    } else if (state.filters.sort === "svc_asc") {
        filtered.sort((a, b) => {
            if (a.days_to_service === null) return 1;
            if (b.days_to_service === null) return -1;
            return (a.days_to_service - b.days_to_service) * dir;
        });
    } else if (state.filters.sort === "last_old") {
        filtered.sort((a, b) => {
            const ad = parseDateOnly(a.last_service_date);
            const bd = parseDateOnly(b.last_service_date);
            if (!ad) return 1;
            if (!bd) return -1;
            return (ad - bd) * dir;
        });
    } else if (state.filters.sort === "status") {
        // Sort by status type and then by urgency (days remaining)
        const statusOrder = { overdue: 1, expiring: 2, ok: 3 };
        filtered.sort((a, b) => {
            // Get status based on current mode
            let aType, bType, aDays, bDays;

            if (state.statusMode === "insurance") {
                // Insurance mode - sort by insurance days
                aDays = a.days_to_insurance ?? 999;
                bDays = b.days_to_insurance ?? 999;
                aType = aDays < 0 ? "overdue" : aDays <= 30 ? "expiring" : "ok";
                bType = bDays < 0 ? "overdue" : bDays <= 30 ? "expiring" : "ok";
            } else {
                // Service mode - sort by combined status
                aType = a.status.type;
                bType = b.status.type;
                aDays = a.days_to_service ?? 999;
                bDays = b.days_to_service ?? 999;
            }

            const aOrder = statusOrder[aType] || 4;
            const bOrder = statusOrder[bType] || 4;

            // Primary: sort by status type
            if (aOrder !== bOrder) {
                return (aOrder - bOrder) * dir;
            }
            // Secondary: sort by days (more urgent first)
            return (aDays - bDays) * dir;
        });
    }

    return filtered;
}

function renderTable() {
    const filtered = applyFiltersAndSort();
    customersTbody.innerHTML = "";

    if (!filtered.length) {
        emptyState.hidden = false;
        return;
    }
    emptyState.hidden = true;

    for (const c of filtered) {
        const tr = document.createElement("tr");


        // Determine color class for Next Service (only if svc_asc column is sorted)
        let nextServiceColorClass = "";
        if (state.filters.sort === "svc_asc" && c.days_to_service !== null) {
            if (c.days_to_service < 0 || c.days_to_service <= 7) {
                nextServiceColorClass = "date-red";
            } else if (c.days_to_service <= 30) {
                nextServiceColorClass = "date-yellow";
            } else {
                nextServiceColorClass = "date-green";
            }
        }

        // Determine color class for Insurance (only if ins_asc column is sorted)
        let insuranceColorClass = "";
        if (state.filters.sort === "ins_asc" && c.days_to_insurance !== null) {
            if (c.days_to_insurance < 0 || c.days_to_insurance <= 7) {
                insuranceColorClass = "date-red";
            } else if (c.days_to_insurance <= 30) {
                insuranceColorClass = "date-yellow";
            } else {
                insuranceColorClass = "date-green";
            }
        }

        tr.innerHTML = `
            <td class="customer-name">${escapeHtml(c.name || "—")}</td>
            <td>
                <div class="vehicle-info">
                    <span class="vehicle-no">${escapeHtml(normalizeVehicle(c.vehicle_no) || "—")}</span>
                    <span class="vehicle-model">${escapeHtml(c.vehicle_model || "")}</span>
                </div>
            </td>
            <td>${escapeHtml(formatDate(c.last_service_date))}</td>
            <td>${c.last_odometer_km !== null ? c.last_odometer_km.toLocaleString() : "—"}</td>
            <td class="${nextServiceColorClass}">${escapeHtml(formatDate(c.upcoming_service_date))}</td>
            <td>${c.upcoming_odometer_km !== null ? c.upcoming_odometer_km.toLocaleString() : "—"}</td>
            <td class="${insuranceColorClass}">${escapeHtml(formatDate(c.insurance_expiry))}</td>
            <td>
                <button class="whatsapp-btn" data-id="${c.id}" title="Send WhatsApp Message">
                    <svg class="whatsapp-icon" viewBox="0 0 24 24" fill="white" width="20" height="20">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                </button>
            </td>
            <td class="actions-col">
                <div class="action-buttons">
                    <button class="action-btn view" data-id="${c.id}" title="View">👁️</button>
                    <button class="action-btn edit" data-id="${c.id}" title="Edit">✏️</button>
                    <a class="action-btn call" href="tel:${normalizeMobile(c.mobile)}" title="Call">📞</a>
                </div>
            </td>
        `;

        customersTbody.appendChild(tr);
    }

    // Attach event listeners
    customersTbody.querySelectorAll(".action-btn.view").forEach(btn => {
        btn.addEventListener("click", () => openDetailModal(btn.dataset.id));
    });

    customersTbody.querySelectorAll(".action-btn.edit").forEach(btn => {
        btn.addEventListener("click", () => openCustomerModal("edit", btn.dataset.id));
    });

    customersTbody.querySelectorAll(".whatsapp-btn").forEach(btn => {
        btn.addEventListener("click", () => openWhatsAppModal(btn.dataset.id));
    });
}

// =========================
// WhatsApp Modal Functions
// =========================
function openWhatsAppModal(customerId) {
    const c = state.customers.find(x => x.id === customerId);
    if (!c) return;

    currentWaCustomer = c;

    waCustomerName.textContent = c.name || "Customer";
    waVehicle.textContent = `${normalizeVehicle(c.vehicle_no) || "—"} • ${c.vehicle_model || ""}`;
    waTodayDate.textContent = formatDate(new Date().toISOString().split("T")[0]);
    waInsuranceDate.textContent = c.insurance_expiry ? formatDate(c.insurance_expiry) : "Not set";
    waServiceDate.textContent = c.last_service_date ? formatDate(c.last_service_date) : "Not set";

    whatsappBackdrop.hidden = false;
    whatsappModal.hidden = false;
}

function closeWhatsAppModal() {
    whatsappBackdrop.hidden = true;
    whatsappModal.hidden = true;
    currentWaCustomer = null;
}

function sendInsuranceReminder() {
    if (!currentWaCustomer) return;

    const c = currentWaCustomer;
    const shopName = state.workshop?.name || "Our Workshop";
    const mobile = normalizeMobile(c.mobile);
    const insuranceDate = c.insurance_expiry ? formatDate(c.insurance_expiry) : "soon";

    const msg = `⚠️ *URGENT: Your Insurance is Expiring Soon!*

Dear *${c.name}*,

📋 *Policy Details:*
• Vehicle: *${normalizeVehicle(c.vehicle_no)}*
• Model: ${c.vehicle_model || "N/A"}
• Expiry Date: *${insuranceDate}*

🚨 *Why Renew Now?*
• Avoid traffic challans & penalties
• Stay protected in case of accidents
• Drive stress-free with valid insurance

📞 Contact us today for quick renewal assistance!

━━━━━━━━━━━━━━━
*${shopName}*
Your Trusted Auto Care Partner 🚗`;

    window.location.href = `whatsapp://send?phone=91${mobile}&text=${encodeURIComponent(msg)}`;
    closeWhatsAppModal();
}

function sendServiceReminder() {
    if (!currentWaCustomer) return;

    const c = currentWaCustomer;
    const shopName = state.workshop?.name || "Our Workshop";
    const mobile = normalizeMobile(c.mobile);
    const lastServiceDate = c.last_service_date ? formatDate(c.last_service_date) : "N/A";
    const lastKm = c.last_odometer_km ? c.last_odometer_km.toLocaleString() : "";

    let kmLine = lastKm ? `• Last Service KM: *${lastKm} km*\n` : "";

    const msg = `🔧 *Time for Your Vehicle Service!*

Dear *${c.name}*,

📋 *Service Details:*
• Vehicle: *${normalizeVehicle(c.vehicle_no)}*
• Model: ${c.vehicle_model || "N/A"}
• Last Service Date: *${lastServiceDate}*
${kmLine}
✅ *Benefits of Regular Service:*
• Extended engine life
• Better mileage & performance
• Avoid costly repairs

📅 Book your slot now before it's too late!

━━━━━━━━━━━━━━━
*${shopName}*
Your Trusted Auto Care Partner 🔧`;

    window.location.href = `whatsapp://send?phone=91${mobile}&text=${encodeURIComponent(msg)}`;
    closeWhatsAppModal();
}

function refreshUI() {
    workshopName.textContent = state.workshop?.name || "Workshop";
    workshopName.title = "Click to edit workshop name";
    workshopName.style.cursor = "pointer";
    updateModeUI();
    renderStats();
    renderTable();
}

// =========================
// Workshop Name Edit
// =========================
async function updateWorkshopName() {
    if (!state.supabase || !state.workshop) {
        toast("error", "Error", "Not logged in");
        return;
    }

    const newName = prompt("Enter new workshop name:", state.workshop.name || "My Workshop");

    if (!newName || newName.trim() === "" || newName.trim() === state.workshop.name) {
        return; // Cancelled or same name
    }

    setLoading(true, "Updating...");

    try {
        const { error } = await state.supabase
            .from('workshops')
            .update({ name: newName.trim() })
            .eq('id', state.workshop.id);

        if (error) throw error;

        state.workshop.name = newName.trim();
        workshopName.textContent = newName.trim();
        toast("success", "Updated", "Workshop name updated successfully");
    } catch (err) {
        toast("error", "Error", err.message || "Failed to update name");
    } finally {
        setLoading(false);
    }
}


// =========================
// Detail Modal
// =========================
function openDetailModal(customerId) {
    const c = state.customers.find(x => x.id === customerId);
    if (!c) return;

    state.selectedCustomerId = customerId;

    detailName.textContent = c.name || "Customer";
    detailAvatar.textContent = "👤";

    const statusClass = c.status.type;
    const statusLabel = c.status.label;
    detailStatus.innerHTML = `<span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>`;

    detailMobile.textContent = normalizeMobile(c.mobile) || "—";
    detailVehicle.textContent = `${normalizeVehicle(c.vehicle_no) || "—"} • ${c.vehicle_model || "—"}`;
    detailAddress.textContent = c.address || "—";
    detailInsurance.textContent = c.insurance_expiry ? formatDate(c.insurance_expiry) : "—";

    detailNextService.textContent = c.upcoming_service_date ? formatDate(c.upcoming_service_date) : "—";
    detailNextOdo.textContent = c.upcoming_odometer_km !== null ? `${c.upcoming_odometer_km.toLocaleString()} km` : "—";

    btnCall.href = `tel:${normalizeMobile(c.mobile)}`;

    btnWhatsApp.onclick = () => openWhatsAppModal(customerId);

    renderServiceHistory(customerId);

    detailBackdrop.hidden = false;
    detailModal.hidden = false;
}

function closeDetailModal() {
    detailBackdrop.hidden = true;
    detailModal.hidden = true;
}

function renderServiceHistory(customerId) {
    const entries = state.serviceEntries
        .filter(e => e.customer_id === customerId)
        .sort((a, b) => parseDateOnly(b.service_date) - parseDateOnly(a.service_date));

    serviceHistoryList.innerHTML = "";

    if (!entries.length) {
        serviceHistoryList.innerHTML = `
            <div class="empty-state" style="padding: 24px;">
                <div class="empty-state-title">No service history</div>
                <div class="empty-state-text">Add the first service entry</div>
            </div>
        `;
        return;
    }

    for (const e of entries) {
        const div = document.createElement("div");
        div.className = "service-entry";

        // Build parts table HTML
        let partsHtml = "";
        if (e.parts && e.parts.length > 0) {
            partsHtml = `
                <table class="parts-table">
                    <thead><tr><th>Part/Service</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${e.parts.map(p => `<tr><td>${escapeHtml(p.name || "—")}</td><td>${money(p.amount)}</td></tr>`).join("")}
                    </tbody>
                </table>
            `;
        }

        // Comments HTML
        let commentsHtml = "";
        if (e.comments) {
            commentsHtml = `<div class="service-entry-comments">💬 ${escapeHtml(e.comments)}</div>`;
        }

        // Notes HTML
        let notesHtml = "";
        if (e.notes) {
            notesHtml = `<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">📝 ${escapeHtml(e.notes)}</div>`;
        }

        div.innerHTML = `
            <div class="service-entry-icon">🔧</div>
            <div class="service-entry-content">
                <div class="service-entry-header">
                    <div>
                        <div class="service-entry-date">${escapeHtml(formatDate(e.service_date))}</div>
                        <div class="service-entry-km">${(e.odometer_km || 0).toLocaleString()} km</div>
                    </div>
                    <div class="service-entry-cost">
                        <div class="service-entry-amount">${money(e.total_cost)}</div>
                        <div class="service-entry-details-link" style="cursor: pointer; color: var(--primary);">▼ Details</div>
                    </div>
                </div>
                <div class="service-entry-details">
                    ${notesHtml}
                    ${partsHtml}
                    ${commentsHtml}
                </div>
            </div>
        `;

        // Click to toggle details
        div.querySelector(".service-entry-details-link").addEventListener("click", () => {
            div.classList.toggle("expanded");
            const link = div.querySelector(".service-entry-details-link");
            link.textContent = div.classList.contains("expanded") ? "▲ Hide" : "▼ Details";
        });

        serviceHistoryList.appendChild(div);
    }
}

// =========================
// Customer Modal
// =========================
function openCustomerModal(mode, customerId = null) {
    state.editingCustomerId = mode === "edit" ? customerId : null;
    customerModalTitle.textContent = mode === "edit" ? "Edit Customer" : "Add Customer";

    if (mode === "edit" && customerId) {
        const c = state.customers.find(x => x.id === customerId);
        if (!c) return;

        // Find raw customer to get manual next service values
        const raw = state.rawCustomers.find(x => x.id === customerId);

        custName.value = c.name || "";
        custMobile.value = normalizeMobile(c.mobile) || "";
        custVehicleNo.value = c.vehicle_no || "";
        custVehicleModel.value = c.vehicle_model || "";
        custAddress.value = c.address || "";
        custInsurance.value = c.insurance_expiry || "";
        custLastService.value = c.last_service_date || "";
        custLastOdo.value = c.last_odometer_km ?? "";
        custNextService.value = raw?.next_service_date || "";
        custNextOdo.value = raw?.next_odometer_km ?? "";
    } else {
        customerFormElement.reset();
    }

    customerBackdrop.hidden = false;
    customerModal.hidden = false;
}

function closeCustomerModal() {
    customerBackdrop.hidden = true;
    customerModal.hidden = true;
}

// =========================
// Service Modal
// =========================
function openServiceModal() {
    serviceFormElement.reset();
    svcDate.value = isoDate(todayStart());
    partsContainer.innerHTML = ""; // Clear parts

    const c = state.customers.find(x => x.id === state.selectedCustomerId);
    if (c && c.last_odometer_km) {
        svcOdo.value = c.last_odometer_km;
    }

    serviceBackdrop.hidden = false;
    serviceModal.hidden = false;
}

function addPartRow(name = "", amount = "") {
    const row = document.createElement("div");
    row.className = "part-row";
    row.innerHTML = `
        <input type="text" class="part-name" placeholder="Part/Service name" value="${escapeHtml(name)}">
        <input type="number" class="part-amount" placeholder="Amount ₹" value="${amount}">
        <button type="button" class="btn-remove-part">✕</button>
    `;

    // Auto-calculate total
    row.querySelector(".part-amount").addEventListener("input", calculatePartsTotal);
    row.querySelector(".btn-remove-part").addEventListener("click", () => {
        row.remove();
        calculatePartsTotal();
    });

    partsContainer.appendChild(row);
}

function calculatePartsTotal() {
    let total = 0;
    partsContainer.querySelectorAll(".part-amount").forEach(input => {
        total += parseInt(input.value) || 0;
    });
    if (total > 0) {
        svcCost.value = total;
    }
}

function getPartsFromForm() {
    const parts = [];
    partsContainer.querySelectorAll(".part-row").forEach(row => {
        const name = row.querySelector(".part-name").value.trim();
        const amount = parseInt(row.querySelector(".part-amount").value) || 0;
        if (name || amount) {
            parts.push({ name, amount });
        }
    });
    return parts;
}

function closeServiceModal() {
    serviceBackdrop.hidden = true;
    serviceModal.hidden = true;
}

// =========================
// CRUD Operations
// =========================
async function saveCustomer() {
    if (!state.supabase) {
        toast("error", "Error", "Supabase not connected. Please add SUPABASE_URL and SUPABASE_ANON_KEY in script.js");
        return;
    }

    const payload = {
        name: custName.value.trim(),
        mobile: normalizeMobile(custMobile.value),
        vehicle_no: normalizeVehicle(custVehicleNo.value),
        vehicle_model: custVehicleModel.value.trim(),
        address: custAddress.value.trim(),
        insurance_expiry: custInsurance.value || null,
        next_service_date: custNextService.value || null,
        next_odometer_km: custNextOdo.value ? parseInt(custNextOdo.value) : null,
        workshop_id: state.workshop?.id
    };

    const lastSvcDate = custLastService.value || null;
    const lastOdo = custLastOdo.value ? parseInt(custLastOdo.value) : null;

    try {
        if (state.editingCustomerId) {
            // Edit existing
            const { error } = await state.supabase
                .from('customers')
                .update(payload)
                .eq('id', state.editingCustomerId);
            if (error) throw error;

            // Add service entry if dates provided
            if (lastSvcDate && lastOdo !== null) {
                const { error: svcError } = await state.supabase
                    .from('service_entries')
                    .insert({
                        customer_id: state.editingCustomerId,
                        service_date: lastSvcDate,
                        odometer_km: lastOdo,
                        notes: "Updated via customer edit",
                        total_cost: 0
                    });
                if (svcError) console.error(svcError);
            }
        } else {
            // Add new customer
            const { data, error } = await state.supabase
                .from('customers')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;

            // Add initial service entry if dates provided
            if (lastSvcDate && lastOdo !== null && data?.id) {
                const { error: svcError } = await state.supabase
                    .from('service_entries')
                    .insert({
                        customer_id: data.id,
                        service_date: lastSvcDate,
                        odometer_km: lastOdo,
                        notes: "Initial service record",
                        total_cost: 0
                    });
                if (svcError) console.error(svcError);
            }
        }

        // Reload data
        await loadSupabaseData();
        rebuildCustomers();
        refreshUI();
    } catch (err) {
        toast("error", "Error", err.message || "Failed to save customer");
        throw err;
    }
}

async function saveServiceEntry() {
    if (!state.supabase) {
        toast("error", "Error", "Supabase not connected. Please add SUPABASE_URL and SUPABASE_ANON_KEY in script.js");
        return;
    }

    const parts = getPartsFromForm();

    const payload = {
        customer_id: state.selectedCustomerId,
        service_date: svcDate.value,
        odometer_km: parseInt(svcOdo.value),
        notes: svcNotes.value.trim(),
        comments: svcComments.value.trim(),
        parts: parts,
        total_cost: parseInt(svcCost.value) || 0
    };

    try {
        const { error } = await state.supabase
            .from('service_entries')
            .insert(payload);
        if (error) throw error;

        // Reload data
        await loadSupabaseData();
        rebuildCustomers();
        refreshUI();
        renderServiceHistory(state.selectedCustomerId);

        // Update detail modal
        const c = state.customers.find(x => x.id === state.selectedCustomerId);
        if (c) {
            detailNextService.textContent = c.upcoming_service_date ? formatDate(c.upcoming_service_date) : "—";
            detailNextOdo.textContent = c.upcoming_odometer_km !== null ? `${c.upcoming_odometer_km.toLocaleString()} km` : "—";
        }
    } catch (err) {
        toast("error", "Error", err.message || "Failed to save service entry");
        throw err;
    }
}

// =========================
// Auth Functions
// =========================
async function supabaseLogin(email, password) {
    if (!state.supabase) {
        toast("error", "Error", "Supabase not connected. Please add SUPABASE_URL and SUPABASE_ANON_KEY in script.js");
        return;
    }

    setLoading(true, "Signing in...");

    try {
        const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        state.session = data.session;
        state.user = data.user;

        // Load workshop and data from Supabase
        await loadSupabaseData();

        showDashboard();
        rebuildCustomers();
        refreshUI();
        toast("success", "Welcome", "Signed in successfully");
    } catch (err) {
        toast("error", "Login Failed", err.message || "Check your credentials");
    } finally {
        setLoading(false);
    }
}

async function loadSupabaseData() {
    if (!state.supabase || !state.user) return;

    try {
        // Load workshop for current user
        const { data: workshops, error: wError } = await state.supabase
            .from('workshops')
            .select('*')
            .eq('user_id', state.user.id)
            .limit(1);

        if (wError) throw wError;

        if (workshops && workshops.length > 0) {
            state.workshop = workshops[0];
        } else {
            // If no workshop, create one using data from signup (stored in user metadata)
            const userMeta = state.user.user_metadata || {};
            const workshopNameFromSignup = userMeta.workshop_name || 'My Workshop';
            const ownerNameFromSignup = userMeta.owner_name || state.user.email;

            const { data: newWorkshop, error: createError } = await state.supabase
                .from('workshops')
                .insert({
                    name: workshopNameFromSignup,
                    user_id: state.user.id,
                    owner_name: ownerNameFromSignup
                })
                .select()
                .single();
            if (createError) throw createError;
            state.workshop = newWorkshop;
        }

        // Load customers for this workshop
        const { data: customers, error: cError } = await state.supabase
            .from('customers')
            .select('*')
            .eq('workshop_id', state.workshop.id);

        if (cError) throw cError;
        state.rawCustomers = customers || [];

        // Load all service entries for these customers
        const customerIds = state.rawCustomers.map(c => c.id);
        if (customerIds.length > 0) {
            const { data: entries, error: eError } = await state.supabase
                .from('service_entries')
                .select('*')
                .in('customer_id', customerIds);

            if (eError) throw eError;
            state.serviceEntries = entries || [];
        } else {
            state.serviceEntries = [];
        }
    } catch (err) {
        toast("error", "Load Error", err.message || "Failed to load data");
    }
}

async function logout() {
    setLoading(true, "Signing out...");

    try {
        if (state.supabase) {
            await state.supabase.auth.signOut();
        }

        state.session = null;
        state.user = null;
        state.workshop = null;
        state.rawCustomers = [];
        state.customers = [];
        state.serviceEntries = [];

        showAuth("login");
        toast("success", "Logged Out", "You have been signed out");
    } catch (err) {
        toast("error", "Error", err.message || "Failed to logout");
    } finally {
        setLoading(false);
    }
}

// =========================
// Event Listeners
// =========================
function wireEvents() {
    // Auth navigation
    btnGoSignup.addEventListener("click", e => { e.preventDefault(); showAuth("signup"); });
    btnGoForgot.addEventListener("click", e => { e.preventDefault(); showAuth("forgot"); });
    btnBackLogin1.addEventListener("click", e => { e.preventDefault(); showAuth("login"); });
    btnBackLogin2.addEventListener("click", e => { e.preventDefault(); showAuth("login"); });

    // Auth actions
    btnLogout.addEventListener("click", logout);

    // Login form
    loginFormElement.addEventListener("submit", async e => {
        e.preventDefault();
        const email = $("#loginEmail").value.trim();
        const password = $("#loginPassword").value;

        await supabaseLogin(email, password);
    });

    // Signup form
    signupFormElement.addEventListener("submit", async e => {
        e.preventDefault();

        if (!state.supabase) {
            toast("error", "Error", "Supabase not connected. Please add SUPABASE_URL and SUPABASE_ANON_KEY in script.js");
            return;
        }

        const workshopName = $("#signupWorkshop").value.trim();
        const ownerName = $("#signupOwner").value.trim();
        const email = $("#signupEmail").value.trim();
        const password = $("#signupPassword").value;

        if (!workshopName || !ownerName || !email || !password) {
            toast("warning", "Missing Fields", "Please fill all required fields");
            return;
        }

        setLoading(true, "Creating account...");

        try {
            // Create user account
            const { data, error } = await state.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        workshop_name: workshopName,
                        owner_name: ownerName
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                state.session = data.session;
                state.user = data.user;

                // Create workshop for this user
                const { data: workshop, error: wError } = await state.supabase
                    .from('workshops')
                    .insert({
                        name: workshopName,
                        owner_name: ownerName,
                        user_id: data.user.id
                    })
                    .select()
                    .single();

                if (wError) {
                    console.error("Workshop creation error:", wError);
                    // Still show success if user was created
                }

                if (workshop) {
                    state.workshop = workshop;
                }

                // If email confirmation is required
                if (!data.session) {
                    toast("success", "Check Email", "Please check your email to confirm your account");
                    showAuth("login");
                } else {
                    showDashboard();
                    rebuildCustomers();
                    refreshUI();
                    toast("success", "Welcome!", "Account created successfully");
                }
            }
        } catch (err) {
            toast("error", "Signup Failed", err.message || "Could not create account");
        } finally {
            setLoading(false);
        }
    });

    // Forgot form
    forgotFormElement.addEventListener("submit", async e => {
        e.preventDefault();
        toast("warning", "Password Reset", "Configure Supabase credentials for password reset");
    });

    // Dashboard
    searchInput.addEventListener("input", () => {
        state.filters.search = searchInput.value;
        renderTable();
    });

    sortSelect.addEventListener("change", () => {
        state.filters.sort = sortSelect.value;
        renderTable();
    });

    btnAddCustomer.addEventListener("click", () => openCustomerModal("add"));

    // Filter dropdown
    const btnFilters = $("#btnFilters");
    const filterDropdown = $("#filterDropdown");
    const filterBadge = $("#filterBadge");
    const btnResetFilters = $("#btnResetFilters");

    btnFilters.addEventListener("click", (e) => {
        e.stopPropagation();
        filterDropdown.hidden = !filterDropdown.hidden;
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".filter-dropdown-wrapper")) {
            filterDropdown.hidden = true;
        }
    });

    // Filter chips
    $$(".filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const filterType = chip.dataset.filter;
            const value = chip.dataset.value;

            state.filters[filterType] = value;

            // Update active state for this filter group
            const group = chip.closest(".filter-section");
            group.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            updateFilterBadge();
            renderTable();
        });
    });

    // Reset filters
    btnResetFilters.addEventListener("click", () => {
        state.filters.insurance = "all";
        state.filters.service = "all";
        state.filters.status = "all";

        // Reset all chips to first option
        $$(".filter-section").forEach(section => {
            section.querySelectorAll(".filter-chip").forEach((c, i) => {
                c.classList.toggle("active", i === 0);
            });
        });

        updateFilterBadge();
        renderTable();
    });

    function updateFilterBadge() {
        let count = 0;
        if (state.filters.insurance !== "all") count++;
        if (state.filters.service !== "all") count++;
        if (state.filters.status !== "all") count++;

        filterBadge.hidden = count === 0;
        filterBadge.textContent = count;
    }

    // Sortable headers
    $$(".data-table th.sortable").forEach(th => {
        th.addEventListener("click", () => {
            const sortKey = th.dataset.sort;

            // Toggle direction if same column, else reset to asc
            if (state.filters.sort === sortKey) {
                state.filters.sortDirection = state.filters.sortDirection === "asc" ? "desc" : "asc";
            } else {
                state.filters.sort = sortKey;
                state.filters.sortDirection = "asc";
            }

            // Update sort dropdown to match
            sortSelect.value = sortKey;

            // Update active state
            $$(".data-table th.sortable").forEach(h => h.classList.remove("active"));
            th.classList.add("active");

            // Update sort icons
            $$(".data-table th.sortable .sort-icon").forEach(icon => {
                icon.textContent = "↕";
            });
            const icon = th.querySelector(".sort-icon");
            if (icon) {
                icon.textContent = state.filters.sortDirection === "asc" ? "↓" : "↑";
            }

            renderTable();
        });
    });

    // Actions column toggle - hidden by default
    const btnToggleActions = $("#btnToggleActions");
    document.body.classList.add("hide-actions"); // Hide by default

    btnToggleActions.addEventListener("click", () => {
        document.body.classList.toggle("hide-actions");
        btnToggleActions.classList.toggle("active");
    });

    // Status mode toggle - service by default
    const btnToggleStatus = $("#btnToggleStatus");
    btnToggleStatus.classList.add("active"); // Service is active by default

    btnToggleStatus.addEventListener("click", () => {
        if (state.statusMode === "service") {
            state.statusMode = "insurance";
            btnToggleStatus.innerHTML = "<span>📋</span> Insurance";
        } else {
            state.statusMode = "service";
            btnToggleStatus.innerHTML = "<span>🔧</span> Service";
        }
        btnToggleStatus.classList.toggle("active");
        renderTable();
    });

    // Detail modal
    btnCloseDetail.addEventListener("click", closeDetailModal);
    detailBackdrop.addEventListener("click", closeDetailModal);
    btnAddService.addEventListener("click", openServiceModal);

    // Customer modal
    btnCloseCustomer.addEventListener("click", closeCustomerModal);
    btnCancelCustomer.addEventListener("click", closeCustomerModal);
    customerBackdrop.addEventListener("click", closeCustomerModal);

    customerFormElement.addEventListener("submit", async e => {
        e.preventDefault();
        setLoading(true, "Saving...");
        try {
            await saveCustomer();
            closeCustomerModal();
            toast("success", "Saved", "Customer saved successfully");
        } catch (err) {
            toast("error", "Error", err.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    });

    // Service modal
    btnCloseService.addEventListener("click", closeServiceModal);
    btnCancelService.addEventListener("click", closeServiceModal);
    serviceBackdrop.addEventListener("click", closeServiceModal);

    // Add Part button
    btnAddPart.addEventListener("click", () => addPartRow());

    serviceFormElement.addEventListener("submit", async e => {
        e.preventDefault();
        setLoading(true, "Saving...");
        try {
            await saveServiceEntry();
            closeServiceModal();
            toast("success", "Saved", "Service entry added");
        } catch (err) {
            toast("error", "Error", err.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    });

    // Escape key
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            if (!detailModal.hidden) closeDetailModal();
            if (!customerModal.hidden) closeCustomerModal();
            if (!serviceModal.hidden) closeServiceModal();
            if (!whatsappModal.hidden) closeWhatsAppModal();
        }
    });

    // WhatsApp Modal
    btnCloseWhatsapp.addEventListener("click", closeWhatsAppModal);
    whatsappBackdrop.addEventListener("click", closeWhatsAppModal);

    btnMsgInsurance.addEventListener("click", sendInsuranceReminder);
    btnMsgService.addEventListener("click", sendServiceReminder);
}

// =========================
// Boot
// =========================
async function boot() {
    showAuth("login");
    state.supabase = initSupabase();

    // Show error if Supabase is not configured
    if (!state.supabase) {
        toast("error", "Configuration Required", "Supabase not connected. Please add SUPABASE_URL and SUPABASE_ANON_KEY in script.js");
    }

    updateModeUI();
    wireEvents();

    // Try to restore Supabase session if configured
    if (state.supabase) {
        try {
            const { data } = await state.supabase.auth.getSession();
            if (data?.session) {
                state.session = data.session;
                state.user = data.session.user;

                // Load data from Supabase
                await loadSupabaseData();

                // Show dashboard
                showDashboard();
                rebuildCustomers();
                refreshUI();
            }
        } catch (_) { }
    }
}

boot();
