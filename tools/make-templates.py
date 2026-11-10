# Lager produktmalene templates/product.flis-hund.json og product.flis-hytte.json
# for Vessel-temaet (Horizon-struktur), basert på butikkens vanlige produktmal.
import json, os
pad0 = {"padding-block-start": 0, "padding-block-end": 0, "padding-inline-start": 0, "padding-inline-end": 0}
group_base = {
    "vertical_on_mobile": True, "align_baseline": False, "width": "fill", "custom_width": 100,
    "width_mobile": "fill", "custom_width_mobile": 100, "height": "fit", "custom_height": 100,
    "background_media": "none", "video_position": "cover", "background_image_position": "cover",
    "toggle_overlay": False, "overlay_color": "#00000026", "overlay_style": "solid", "gradient_direction": "to top",
    "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0, "link": "", "open_in_new_tab": False,
}
def text(html, preset="paragraph", font="var(--font-primary--family)", size=""):
    return {"type": "text", "settings": {"text": html, "width": "100%", "max_width": "normal", "alignment": "left",
            "type_preset": preset, "font": font, "font_size": size, "line_height": "normal", "letter_spacing": "normal",
            "case": "none", "wrap": "pretty", "background": False, "background_color": "#00000026", "corner_radius": 0, **pad0},
            "blocks": {}}

def template(preset, heading, intro, link):
    return {
      "sections": {
        "main": {
          "type": "product-information",
          "blocks": {
            "media-gallery": {"type": "_product-media-gallery", "static": True, "settings": {
              "media_presentation": "carousel", "media_columns": "two", "image_gap": 1, "large_first_image": False,
              "icons_style": "arrows", "slideshow_controls_style": "thumbnails", "slideshow_mobile_controls_style": "dots",
              "thumbnail_position": "bottom", "thumbnail_width": 48, "aspect_ratio": "1", "constrain_to_viewport": True,
              "media_radius": 0, "extend_media": False, "zoom": True, "video_loop": True, "hide_variants": False,
              "padding-block-start": 0, "padding-block-end": 0, "padding-inline-start": 0, "padding-inline-end": 0}, "blocks": {}},
            "product-details": {"type": "_product-details", "static": True, "settings": {
              "width": "fill", "custom_width": 75, "width_mobile": "fill", "custom_width_mobile": 100, "gap": 20,
              "sticky_details_desktop": True, "background_media": "none", "video_position": "cover",
              "background_image_position": "cover", "border": "none", "border_width": 1, "border_opacity": 100,
              "border_radius": 0, "padding-block-start": 18, "padding-block-end": 48, "padding-inline-start": 0,
              "padding-inline-end": 0},
              "blocks": {
                "group_main": {"type": "group", "name": "t:names.group", "settings": {**group_base,
                  "content_direction": "column", "horizontal_alignment": "flex-start", "vertical_alignment": "center",
                  "horizontal_alignment_flex_direction_column": "flex-start", "vertical_alignment_flex_direction_column": "center",
                  "gap": 28, "custom_width": 65, "padding-block-start": 40, "padding-block-end": 0,
                  "padding-inline-start": 0, "padding-inline-end": 0},
                  "blocks": {
                    "group_header": {"type": "group", "name": "Header", "settings": {**group_base,
                      "content_direction": "column", "horizontal_alignment": "flex-start", "vertical_alignment": "flex-start",
                      "horizontal_alignment_flex_direction_column": "flex-start", "vertical_alignment_flex_direction_column": "center",
                      "gap": 8, **pad0},
                      "blocks": {
                        "title": text("<h1>{{ closest.product.title }}</h1>", "h2"),
                        "price": {"type": "price", "settings": {"show_sale_price_first": True, "show_installments": True,
                          "show_tax_info": True, "type_preset": "h5", "width": "100%", "alignment": "left",
                          "font": "var(--font-body--family)", "font_size": "1rem", "line_height": "normal",
                          "letter_spacing": "normal", "case": "none", "padding-block-start": 4, "padding-block-end": 0,
                          "padding-inline-start": 0, "padding-inline-end": 0}, "blocks": {}},
                      },
                      "block_order": ["title", "price"]},
                    "divider": {"type": "_divider", "name": "t:names.divider", "settings": {"thickness": 1,
                      "corner_radius": "square", "width_percent": 100, "padding-block-start": 0, "padding-block-end": 0}, "blocks": {}},
                    "description": {**text("{{ closest.product.description }}"), "type": "product-description", "name": "Product description"},
                    "flis_link": text(f'<p><a href="#lag-flis"><strong>{link}</strong></a></p>', "paragraph", "var(--font-body--family)", "1rem"),
                    "accordion": {"type": "accordion", "name": "t:names.accordion", "settings": {"icon": "plus", "dividers": True,
                      "type_preset": "h5", "border": "none", "border_width": 1, "border_opacity": 100, "border_radius": 0, **pad0},
                      "blocks": {"row": {"type": "_accordion-row", "settings": {"heading": "BESTILLINGER OG RETURER", "open_by_default": False},
                        "blocks": {"row_text": text("<p>Vi jobber raskt og grundig for å behandle og sende alle bestillinger, slik at varene dine er på vei til deg så snart som mulig. Trenger du å returnere noe? Bare gi oss beskjed.</p>",
                                                    "rte", "var(--font-body--family)", "1rem")},
                        "block_order": ["row_text"]}},
                      "block_order": ["row"]},
                  },
                  "block_order": ["group_header", "divider", "description", "flis_link", "accordion"]},
              },
              "block_order": ["group_main"]},
          },
          "settings": {"content_width": "content-center-aligned", "desktop_media_position": "left", "equal_columns": True,
                       "limit_details_width": True, "gap": 48, "background_color": "{{ settings.color_palette.background }}",
                       "padding-block-start": 0, "padding-block-end": 20},
        },
        "flis_editor": {"type": "flis-editor", "settings": {"preset": preset, "heading": heading, "intro": intro,
                        "padding_top": 36, "padding_bottom": 60}},
      },
      "order": ["main", "flis_editor"],
    }

def tekst_template(heading, intro, link):
    """Produktmal med tekst-editoren (gravert tekst), f.eks. personlig vinåpner."""
    t = template("hund", heading, intro, link)
    t["sections"]["main"]["blocks"]["product-details"]["blocks"]["group_main"]["blocks"]["flis_link"]["settings"]["text"] = \
        f'<p><a href="#lag-gravering"><strong>{link}</strong></a></p>'
    del t["sections"]["flis_editor"]
    t["sections"]["tekst_editor"] = {"type": "tekst-editor", "settings": {
        "product_type": "korketrekker", "image_asset": "korketrekker-tom.jpg",
        "heading": heading, "intro": intro, "padding_top": 36, "padding_bottom": 60}}
    t["order"] = ["main", "tekst_editor"]
    return t

def familietre_template(heading, intro, link):
    """Produktmal med familietre-editoren."""
    t = template("hund", heading, intro, link)
    t["sections"]["main"]["blocks"]["product-details"]["blocks"]["group_main"]["blocks"]["flis_link"]["settings"]["text"] = \
        f'<p><a href="#lag-familietre"><strong>{link}</strong></a></p>'
    del t["sections"]["flis_editor"]
    t["sections"]["familietre_editor"] = {"type": "familietre-editor", "settings": {
        "export_page": "svg-eksport", "heading": heading, "intro": intro, "padding_top": 36, "padding_bottom": 60}}
    t["order"] = ["main", "familietre_editor"]
    return t

os.makedirs("shopify/templates", exist_ok=True)
with open("shopify/templates/product.tekst-vinapner.json", "w") as f:
    json.dump(tekst_template("Lag din gravering",
        "<p>Skriv inn navn, årstall eller en kort hilsen, og velg skrift. Du ser med en gang hvordan graveringen blir på vinåpneren.</p>",
        "Skriv teksten din og se graveringen ↓"), f, ensure_ascii=False, indent=2)
for key, heading, intro, link in [
    ("hund", "Lag flisen med din hund",
     "<p>Last opp et bilde av hunden, plasser det i ruten og legg gjerne til navnet. Vi graverer det på en 20 × 20 cm keramisk flis.</p>",
     "Last opp bilde av hunden din ↓"),
    ("hytte", "Lag flisen med din hytte",
     "<p>Last opp et bilde av hytta, plasser det i ruten og legg gjerne til hyttenavnet. Vi graverer det på en 20 × 20 cm keramisk flis.</p>",
     "Last opp bilde av hytta di ↓"),
    ("familie", "Lag flisen med familien din",
     "<p>Last opp et familiebilde eller portrett, plasser det i ruten og legg gjerne til et navn. Bildet kan dekke hele flisen, eller få en myk mørk kant. Vi graverer det på en 20 × 20 cm keramisk flis.</p>",
     "Last opp familiebildet ditt ↓"),
]:
    with open(f"shopify/templates/product.flis-{key}.json", "w") as f:
        json.dump(template(key, heading, intro, link), f, ensure_ascii=False, indent=2)
print("ok")
with open("shopify/templates/product.familietre.json", "w") as f:
    json.dump(familietre_template("Lag ditt familietre",
        "<p>Velg utførelse, skriv teksten nederst, for eksempel «Oldemor», og opptil 16 navn på hjertene. Du ser med en gang hvordan familietreet blir.</p>",
        "Lag ditt familietre med navn ↓"), f, ensure_ascii=False, indent=2)

def dorskilt_template(heading, intro, link):
    """Produktmal med dørskilt-editoren."""
    t = familietre_template(heading, intro, link)
    t["sections"]["main"]["blocks"]["product-details"]["blocks"]["group_main"]["blocks"]["flis_link"]["settings"]["text"] = \
        f'<p><a href="#lag-dorskilt"><strong>{link}</strong></a></p>'
    t["sections"]["dorskilt_editor"] = t["sections"].pop("familietre_editor")
    t["sections"]["dorskilt_editor"]["type"] = "dorskilt-editor"
    t["order"] = ["main", "dorskilt_editor"]
    return t

with open("shopify/templates/product.dorskilt.json", "w") as f:
    json.dump(dorskilt_template("Lag ditt dørskilt",
        "<p>Skriv topptekst og navn, og velg motiv i midten. Du ser med en gang hvordan dørskiltet blir.</p>",
        "Lag ditt dørskilt ↓"), f, ensure_ascii=False, indent=2)

def bilflis_template(heading, intro, link, api_url=""):
    """Produktmal med bilflis-editoren (AI-bilde av kundens bil)."""
    t = familietre_template(heading, intro, link)
    t["sections"]["main"]["blocks"]["product-details"]["blocks"]["group_main"]["blocks"]["flis_link"]["settings"]["text"] = \
        f'<p><a href="#lag-bilflis"><strong>{link}</strong></a></p>'
    t["sections"].pop("familietre_editor")
    t["sections"]["bilflis_editor"] = {"type": "bilflis-editor", "settings": {
        "api_url": api_url, "stil1_label": "Røyk og brostein", "stil2_label": "Stormnatt",
        "stil1_image": "shopify://shop_images/bilflis-stil1.png", "stil2_image": "shopify://shop_images/bilflis-stil2.png",
        "heading": heading, "intro": intro, "padding_top": 36, "padding_bottom": 60}}
    t["order"] = ["main", "bilflis_editor"]
    return t

with open("shopify/templates/product.bilflis.json", "w") as f:
    json.dump(bilflis_template("Lag din bilflis",
        "<p>Velg stil og last opp et bilde av bilen din. Vi setter bilen inn i bildet, og du ser resultatet før du bestiller.</p>",
        "Lag din bilflis ↓"), f, ensure_ascii=False, indent=2)
