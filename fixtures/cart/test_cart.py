import unittest

from cart import apply_discount, cart_total


class TestCart(unittest.TestCase):
    def test_twenty_percent_off(self):
        self.assertEqual(apply_discount(50, 20), 40)

    def test_no_discount(self):
        self.assertEqual(cart_total([12.5, 7.5]), 20)

    def test_total_with_discount(self):
        self.assertEqual(cart_total([30, 20], discount_percent=10), 45)


if __name__ == "__main__":
    unittest.main()
