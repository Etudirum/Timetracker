from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Créer une nouvelle image avec fond gradient
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Fond arrondi violet
    margin = size // 8
    draw.rounded_rectangle(
        [margin, margin, size-margin, size-margin], 
        radius=size//6, 
        fill=(139, 92, 246, 255)
    )
    
    # Écran d'ordinateur
    screen_margin = size // 4
    screen_width = size - 2 * screen_margin
    screen_height = screen_width * 3 // 4
    screen_y = size // 3
    
    # Écran principal
    draw.rounded_rectangle(
        [screen_margin, screen_y, screen_margin + screen_width, screen_y + screen_height],
        radius=size//20,
        fill=(255, 255, 255, 240)
    )
    
    # Contenu de l'écran
    inner_margin = screen_margin + size // 20
    inner_width = screen_width - 2 * (size // 20)
    inner_height = screen_height - 2 * (size // 20)
    
    draw.rounded_rectangle(
        [inner_margin, screen_y + size//20, inner_margin + inner_width, screen_y + size//20 + inner_height],
        radius=size//40,
        fill=(248, 250, 252, 255)
    )
    
    # Horloge
    clock_center_x = inner_margin + inner_width // 3
    clock_center_y = screen_y + size//20 + inner_height // 2
    clock_radius = size // 12
    
    draw.ellipse(
        [clock_center_x - clock_radius, clock_center_y - clock_radius,
         clock_center_x + clock_radius, clock_center_y + clock_radius],
        fill=(139, 92, 246, 200)
    )
    
    # Aiguilles d'horloge
    draw.line(
        [clock_center_x, clock_center_y, clock_center_x, clock_center_y - clock_radius//2],
        fill=(255, 255, 255, 255),
        width=max(1, size//100)
    )
    draw.line(
        [clock_center_x, clock_center_y, clock_center_x + clock_radius//3, clock_center_y],
        fill=(255, 255, 255, 255),
        width=max(1, size//120)
    )
    
    # Graphiques en barres
    bar_start_x = inner_margin + 2 * inner_width // 3
    bar_y = screen_y + size//20 + inner_height // 4
    bar_width = size // 25
    bar_spacing = size // 20
    
    heights = [inner_height//3, inner_height//4, inner_height//2, inner_height//3]
    colors = [(6, 182, 212), (16, 185, 129), (245, 158, 11), (239, 68, 68)]
    
    for i, (height, color) in enumerate(zip(heights, colors)):
        x = bar_start_x + i * bar_spacing
        draw.rounded_rectangle(
            [x, screen_y + size//20 + inner_height - height, x + bar_width, screen_y + size//20 + inner_height],
            radius=size//100,
            fill=color
        )
    
    # Support d'écran
    support_width = screen_width // 2
    support_height = size // 25
    support_x = screen_margin + (screen_width - support_width) // 2
    support_y = screen_y + screen_height + size // 40
    
    draw.rounded_rectangle(
        [support_x, support_y, support_x + support_width, support_y + support_height],
        radius=size//40,
        fill=(255, 255, 255, 230)
    )
    
    # Base du support
    base_width = support_width // 3
    base_height = size // 50
    base_x = screen_margin + (screen_width - base_width) // 2
    base_y = support_y + support_height + size // 80
    
    draw.rounded_rectangle(
        [base_x, base_y, base_x + base_width, base_y + base_height],
        radius=size//80,
        fill=(255, 255, 255, 230)
    )
    
    return img

# Créer toutes les tailles d'icônes nécessaires
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    icon = create_icon(size)
    icon.save(f'icon-{size}x{size}.png', 'PNG')
    print(f'Created icon-{size}x{size}.png')

print("Toutes les icônes ont été créées avec succès!")
