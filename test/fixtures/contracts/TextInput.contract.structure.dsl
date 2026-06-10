component TextInput

props {
  icon instance = "icon"
  showName boolean = true
  fieldName text = "Field name"
  placeholderText text = "Placeholder"
  text text = "Text"
  footnote boolean = true
  State variant = "Disabled" // "Empty" | "Filled" | "Disabled"
  Active variant = "Off" // "Off" | "On"
  Writing variant = "Default" // "Default" | "RTL"
}

contracts {
  visuals TextInput.contract.visuals.yaml
  geometry TextInput.contract.geometry.yaml
  meta TextInput.contract.meta.yaml
}

variantAxes {
  Active: Off | On
  State: Disabled | Empty | Filled
  Writing: Default | RTL
}

resolve {
  scheme = visuals[Active][State][Writing]
  geometry = geometry[Active][State][Writing]
}

dispatch {
  Writing = "Default" => writingDefault
  Writing = "RTL" => writingRTL
  fallback => writingDefault
}

templates {
  template writingDefault when Writing = "Default" {
    VStack root { // State=Disabled, Active=Off, Writing=Default
      style scheme.root
      layout geometry.root
      HStack fieldName when showName { // Field name
        style scheme.fieldName
        layout geometry.fieldName
        Text fieldName when showName { // Field name
          style scheme.fieldName
          layout geometry.fieldName
          content ${fieldName}
        }
      }
      HStack field { // field
        style scheme.field
        layout geometry.field
        HStack iconContainer when icon { // icon-container
          style scheme.iconContainer
          layout geometry.iconContainer
          Icon searchIcon { // SearchIcon
            style scheme.searchIcon
            layout geometry.searchIcon
            instance ${icon}
          }
        }
        Text placeholder { // Placeholder
          style scheme.placeholder
          layout geometry.placeholder
          content ${placeholderText}
        }
        Icon xCircleIcon { // XCircleIcon
          style scheme.xCircleIcon
          layout geometry.xCircleIcon
          instance XCircleIcon
        }
      }
      TextFootnote textFootnote when footnote { // TextFootnote
        style scheme.textFootnote
        layout geometry.textFootnote
        instance TextFootnote
        Text footnoteText { // Footnote text
          style scheme.footnoteText
          layout geometry.footnoteText
          content ${footnoteText}
        }
      }
    }
  }

  template writingRTL when Writing = "RTL" {
    VStack root { // State=Disabled, Active=Off, Writing=RTL
      style scheme.root
      layout geometry.root
      HStack fieldName when showName { // Field name
        style scheme.fieldName
        layout geometry.fieldName
        Text fieldName when showName { // Field name
          style scheme.fieldName
          layout geometry.fieldName
          content ${fieldName}
        }
      }
      HStack field { // field
        style scheme.field
        layout geometry.field
        Icon xCircleIcon { // XCircleIcon
          style scheme.xCircleIcon
          layout geometry.xCircleIcon
          instance XCircleIcon
        }
        Text placeholder { // Placeholder
          style scheme.placeholder
          layout geometry.placeholder
          content ${placeholderText}
        }
        HStack iconContainer when icon { // icon-container
          style scheme.iconContainer
          layout geometry.iconContainer
          Icon searchIcon { // SearchIcon
            style scheme.searchIcon
            layout geometry.searchIcon
            instance ${icon}
          }
        }
      }
      TextFootnote textFootnote when footnote { // TextFootnote
        style scheme.textFootnote
        layout geometry.textFootnote
        instance TextFootnote
        Text footnoteText { // Footnote text
          style scheme.footnoteText
          layout geometry.footnoteText
          content ${footnoteText}
        }
      }
    }
  }
}
