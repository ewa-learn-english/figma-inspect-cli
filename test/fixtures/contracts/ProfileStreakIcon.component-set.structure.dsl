component ProfileStreakIcon

props {
  Status variant = "Missed" // "Active" | "Missed" | "Loading"
  Size variant = "M" // "M" | "XL"
}

contracts {
  visuals ProfileStreakIcon.component-set.visuals.yaml
  geometry ProfileStreakIcon.component-set.geometry.yaml
  meta ProfileStreakIcon.component-set.meta.yaml
}

variantAxes {
  Size: M | XL
  Status: Active | Loading | Missed
}

resolve {
  scheme = visuals[Size][Status]
  geometry = geometry[Size][Status]
  asset = meta.assets[Size][Status]
}

dispatch {
  fallback => allVariants
}

templates {
  template allVariants {
    Asset root {
      layout geometry.root
      asset asset
    }
  }
}
