document.addEventListener('DOMContentLoaded', () => {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const btn = dropdown.querySelector('.dropbtn');
    const links = dropdown.querySelectorAll('.dropdown-content a');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      dropdowns.forEach(other => {
        if (other !== dropdown) other.classList.remove('active');
      });

      dropdown.classList.toggle('active');
    });

    links.forEach(link => {
      link.addEventListener('click', () => {
        dropdown.classList.remove('active');
      });
    });
  });
  

  document.addEventListener('click', () => {
    dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
  });
});