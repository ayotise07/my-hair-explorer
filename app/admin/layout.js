import AdminNav from "./AdminNav";
import AuthGate from "./AuthGate";

export const metadata = {
  title: "MHE. Admin",
};

export default function AdminLayout({ children }) {
  return (
    <AuthGate>
      <div className="admin-shell">
        <AdminNav />
        <main className="admin-main">{children}</main>
      </div>
    </AuthGate>
  );
}
