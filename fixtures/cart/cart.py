"""A tiny shopping cart."""


def apply_discount(price, percent):
    """Return the price after taking `percent` off. 20 means 20% off."""
    return price * percent / 100


def cart_total(prices, discount_percent=0):
    """Add up the prices, then apply the discount to the total."""
    total = sum(prices)
    if discount_percent:
        total = apply_discount(total, discount_percent)
    return round(total, 2)
