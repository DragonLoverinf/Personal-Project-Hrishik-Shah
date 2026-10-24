//Only navigation and buttons for now, simulations get added later.
//Modules: Navigation, Router.
"use strict";

//Shortcut to get one element by its id.
const $ = (id) => document.getElementById(id);

//Shortcut to get all elements matching a selector, as an array.
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

//Navigation
//Hamburger menu on small screens + highlighting the current link.
const Navigation = {
    init() {
        //Saved here so the other functions can use them.
        this.toggle = $("nav-toggle");
        this.links = $("nav-links");

        //Hamburger opens/closes the menu.
        this.toggle.addEventListener("click", () => {
            const open = this.links.classList.toggle("open");
            //Screen readers use this to know if the menu is open.
            this.toggle.setAttribute("aria-expanded", String(open));
        });

        //Menu closes after picking a link, otherwise it covers the page on phones.
        this.links.addEventListener("click", (e) => {
            if (e.target.closest("a")) this.close();
        });
    },

    //Closes the mobile menu.
    close() {
        this.links.classList.remove("open");
        this.toggle.setAttribute("aria-expanded", "false");
    },

    //Highlights the link for the page that is showing.
    setActive(pageId) {
        $$("[data-nav]").forEach((a) => {
            //Only links in the navbar get highlighted, not the site name.
            a.classList.toggle("active", a.dataset.nav === pageId && a.closest(".navbar__links"));
        });
    }
};

//Router
//Shows one page at a time using the URL hash, so no page reload.
const Router = {
    //Page shown if the hash is empty or not a real page.
    defaultPage: "home",

    init() {
        //Hash changes (link click, back button) so show that page.
        window.addEventListener("hashchange", () => this.show(this.current()));

        //Anything with data-goto="pageId" jumps to that page (like the back buttons).
        document.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-goto]");
            if (btn) window.location.hash = btn.dataset.goto;
        });

        //Show the right page when the site first loads.
        this.show(this.current());
    },

    //Reads the hash, gives back a real page id or home if it is not one.
    current() {
        const id = window.location.hash.replace("#", "");
        return $(id) && $(id).classList.contains("page") ? id : this.defaultPage;
    },

    //Only the chosen page is visible.
    show(pageId) {
        $$(".page").forEach((p) => p.classList.toggle("active", p.id === pageId));
        Navigation.setActive(pageId);

        //Every page starts at the top.
        window.scrollTo(0, 0);
    }
};

//Start up
//Runs after the page has loaded.
document.addEventListener("DOMContentLoaded", () => {
    Navigation.init();

    //Router is last so all the pages exist before the first one shows.
    Router.init();
});

//Assumptions for this setup:
//Pages switch with the URL hash, no server or reload needed.
//No simulations yet, topic pages are placeholders.
//No external libraries, ads, or tracking.