// src/modules/editor/editorSubNav.ts
// import browseIcon from "../../assets/icons/browse_instances.svg";
// import addIcon from "../../assets/icons/add_instance.svg";

export const editorSubNav = {
  title: "Editor",
  ctas: [
    {
      label: "Browse instances",
      href: "/editor/instances",
      variant: "outline-dark",
      size: "sm",
      // icon: <img src={browseIcon} alt="" width={16} height={16} />,
    },
    {
      label: "Create new instance",
      href: "/editor/new",
      variant: "dark",
      size: "sm",
      // icon: <img src={addIcon} alt="" width={16} height={16} />,
    },
  ],
};
