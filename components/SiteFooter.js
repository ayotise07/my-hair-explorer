export default function SiteFooter({ content }) {
  return (
    <footer className="site-footer">
      <span className="fmark">My Hair Explorer.</span>
      <div className="fcontact">
        <span>{content.phone}</span>
        <span>{content.email}</span>
        <span>Instagram</span>
      </div>
      <span>© {new Date().getFullYear()} My Hair Explorer</span>
    </footer>
  );
}
