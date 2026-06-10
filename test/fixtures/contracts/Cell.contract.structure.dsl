component Cell

props {
  leadingIcon boolean = true
  hasValue boolean = true
  label text = "Label"
  value text = "Value"
  replaceIcon instance = "replaceIcon"
  showSticker boolean = false
  Type variant = "Trailing Chevron" // "Action" | "Button" | "Button destructive" | "Avatar" | "Trailing Chevron" | "Trailing Toggle" | "Trailing Checkmark" | "Trailing Value" | "Trailing Button Avatar" | "Trailing Button Icon"
  Writing variant = "Default" // "Default" | "RTL"
  State variant = "Default" // "Default" | "Hover" | "Pressed"
}

contracts {
  visuals Cell.contract.visuals.yaml
  geometry Cell.contract.geometry.yaml
  meta Cell.contract.meta.yaml
}

variantAxes {
  State: Default | Hover | Pressed
  Type: Action | Avatar | Button | Button destructive | Trailing Button Avatar | Trailing Button Icon | Trailing Checkmark | Trailing Chevron | Trailing Toggle | Trailing Value
  Writing: Default | RTL
}

resolve {
  scheme = visuals[State][Type][Writing]
  geometry = geometry[State][Type][Writing]
}

dispatch {
  State = "Default" => stateDefault
  State = "Hover" => stateHover
  State = "Pressed" => statePressed
  fallback => stateDefault
}

templates {
  template stateDefault when State = "Default" {
    HStack root { // Type=Action, Writing=Default, State=Default
      style scheme.root
      layout geometry.root
      HStack iconWrapper when leadingIcon { // icon-wrapper
        style scheme.iconWrapper
        layout geometry.iconWrapper
        Icon placeholderSIcon { // PlaceholderSIcon
          style scheme.placeholderSIcon
          layout geometry.placeholderSIcon
          instance ${replaceIcon}
        }
      }
      VStack content { // content
        style scheme.content
        layout geometry.content
        Text label { // label
          style scheme.label
          layout geometry.label
          content ${label}
        }
        Text text when hasValue { // text
          style scheme.text
          layout geometry.text
          content ${value}
        }
      }
    }
  }

  template stateHover when State = "Hover" {
    HStack root { // Type=Action, Writing=Default, State=Hover
      style scheme.root
      layout geometry.root
      HStack iconWrapper when leadingIcon { // icon-wrapper
        style scheme.iconWrapper
        layout geometry.iconWrapper
        Icon placeholderSIcon { // PlaceholderSIcon
          style scheme.placeholderSIcon
          layout geometry.placeholderSIcon
          instance ${replaceIcon}
        }
      }
      VStack content { // content
        style scheme.content
        layout geometry.content
        Text label { // label
          style scheme.label
          layout geometry.label
          content ${label}
        }
        Text text when hasValue { // text
          style scheme.text
          layout geometry.text
          content ${value}
        }
      }
    }
  }

  template statePressed when State = "Pressed" {
    HStack root { // Type=Action, Writing=Default, State=Pressed
      style scheme.root
      layout geometry.root
      HStack iconWrapper when leadingIcon { // icon-wrapper
        style scheme.iconWrapper
        layout geometry.iconWrapper
        Icon placeholderSIcon { // PlaceholderSIcon
          style scheme.placeholderSIcon
          layout geometry.placeholderSIcon
          instance ${replaceIcon}
        }
      }
      VStack content { // content
        style scheme.content
        layout geometry.content
        Text label { // label
          style scheme.label
          layout geometry.label
          content ${label}
        }
        Text text when hasValue { // text
          style scheme.text
          layout geometry.text
          content ${value}
        }
      }
    }
  }
}
